"use client";

import { useCallback, useEffect, useState, useTransition, Fragment } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileDown,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { api } from "@/lib/api/client";
import { buildClaimBreakdown } from "@/lib/judge-compensation/breakdown";
import { formatReceiptAmountEur } from "@/lib/judge-compensation/receipt-document";
import type { CompensationClaim, CompensationClubContact, CompetitionCompensationSummary } from "@/lib/judge-compensation/types";
import { competitionClubContacts } from "@/lib/judge-compensation/readiness";
import { KNOWN_ORGANIZER_CLUBS, normalizeClubEmails } from "@/lib/organizer-clubs";
import type { Competition } from "@/lib/types";
import { selectFieldClass } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { CompensationExportDialog } from "./compensation-export-dialog";

interface CompensationBoardProps {
  competition: Competition;
  canManage: boolean;
}

function emptyClub(): CompensationClubContact {
  return { name: "", emails: [] };
}

export function CompensationBoard({ competition: initialCompetition, canManage }: CompensationBoardProps) {
  const [competition, setCompetition] = useState(initialCompetition);
  const [summary, setSummary] = useState<CompetitionCompensationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [exportTarget, setExportTarget] = useState<CompensationClaim | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [organizer, setOrganizer] = useState(competition.compensationOrganizer ?? "club");
  const [clubs, setClubs] = useState<CompensationClubContact[]>(
    () => competitionClubContacts(competition).length > 0
      ? competitionClubContacts(competition)
      : [emptyClub()],
  );
  const [volunteer, setVolunteer] = useState(competition.compensationVolunteer ?? false);
  const [sedeDireccion, setSedeDireccion] = useState(competition.sedeDireccion ?? "");

  const claims = summary?.claims ?? [];
  const readiness = summary?.readiness;

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        setError(null);
        const next = await api.getCompensation(competition.id);
        setSummary(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar compensación");
      }
    });
  }, [competition.id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveVenue = () => {
    startTransition(async () => {
      try {
        const updated = await api.updateCompetition(competition.id, { sedeDireccion });
        setCompetition(updated);
        setSedeDireccion(updated.sedeDireccion ?? "");
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar la sede");
      }
    });
  };

  const saveOrganizer = () => {
    startTransition(async () => {
      try {
        const cleaned = clubs
          .map((c) => ({
            name: c.name.trim(),
            emails: c.emails,
          }))
          .filter((c) => c.name);
        const updated = await api.updateCompetition(competition.id, {
          compensationOrganizer: organizer as Competition["compensationOrganizer"],
          compensationClubs: cleaned,
          compensationClubName: cleaned[0]?.name,
          compensationClubEmail: cleaned[0]?.emails.join(", "),
          compensationVolunteer: volunteer,
        });
        setCompetition(updated);
        setClubs(competitionClubContacts(updated).length ? competitionClubContacts(updated) : [emptyClub()]);
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar el organizador");
      }
    });
  };

  const onRecalculate = () => {
    startTransition(async () => {
      try {
        setError(null);
        setSummary(await api.recalculateCompensation(competition.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo recalcular");
      }
    });
  };

  const onCalculateDistances = () => {
    startTransition(async () => {
      try {
        setError(null);
        setSummary(await api.calculateAllCompensationDistances(competition.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron calcular distancias");
      }
    });
  };

  const patchClaim = (refereeId: string, patch: Parameters<typeof api.updateCompensationClaim>[2]) => {
    startTransition(async () => {
      try {
        const updated = await api.updateCompensationClaim(competition.id, refereeId, patch);
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                claims: prev.claims.map((c) => (c.refereeId === refereeId ? updated : c)),
              }
            : prev,
        );
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  };

  const toggleExpanded = (refereeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(refereeId)) next.delete(refereeId);
      else next.add(refereeId);
      return next;
    });
  };

  const venueOk = competition.sedeLat != null && competition.sedeLng != null && Boolean(competition.sedeDireccion);

  return (
    <PageShell className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link href={`/competitions/${competition.id}`}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a tarima
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow="Compensación"
        title={competition.nombre}
        description={`${competition.fecha} → ${competition.fechaFin} · ${competition.sede}`}
      />

      {canManage && (
        <section className="glass-panel-soft space-y-4 rounded-2xl p-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              Sede del campeonato (Google Maps)
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Dirección completa para calcular km desde el domicilio de cada juez.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                className="min-w-[280px] flex-1"
                placeholder="Ej. Polideportivo Municipal, Av. …, ciudad"
                value={sedeDireccion}
                onChange={(e) => setSedeDireccion(e.target.value)}
              />
              <Button type="button" size="sm" onClick={saveVenue} disabled={pending || !sedeDireccion.trim()}>
                Guardar y geocodificar
              </Button>
            </div>
            <p className={cn("mt-2 text-xs", venueOk ? "text-success" : "text-warning")}>
              {venueOk
                ? `Coordenadas OK (${competition.sedeLat?.toFixed(4)}, ${competition.sedeLng?.toFixed(4)})`
                : "Pendiente: guarda una dirección válida de Google Maps."}
            </p>
          </div>

          <div className="border-t border-border-muted pt-4">
            <h2 className="text-sm font-semibold text-foreground">Organizadores del recibo</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Puede haber varios clubes y varios e-mails de devolución (separados por coma).
            </p>
            <div className="mt-3 space-y-3">
              <select
                className={selectFieldClass}
                value={organizer}
                aria-label="Tipo organizador"
                onChange={(e) => setOrganizer(e.target.value as "club" | "aep")}
              >
                <option value="club">Club(es) organizador(es)</option>
                <option value="aep">AEP nacional</option>
              </select>

              {organizer === "club" && (
                <>
                  {clubs.map((club, index) => (
                    <div key={index} className="grid gap-2 rounded-xl border border-border-muted bg-surface/40 p-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Club {clubs.length > 1 ? index + 1 : ""}
                        </label>
                        <Input
                          list="organizer-clubs-list"
                          placeholder="Nombre del club"
                          value={club.name}
                          onChange={(e) =>
                            setClubs((prev) =>
                              prev.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)),
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          E-mails devolución
                        </label>
                        <Input
                          placeholder="uno@club.com, otro@club.com"
                          value={Array.isArray(club.emails) ? club.emails.join(", ") : ""}
                          onChange={(e) =>
                            setClubs((prev) =>
                              prev.map((c, i) =>
                                i === index ? { ...c, emails: normalizeClubEmails(e.target.value) } : c,
                              ),
                            )
                          }
                        />
                      </div>
                      {clubs.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="sm:col-span-2 justify-start text-destructive"
                          onClick={() => setClubs((prev) => prev.filter((_, i) => i !== index))}
                        >
                          Quitar club
                        </Button>
                      )}
                    </div>
                  ))}
                  <datalist id="organizer-clubs-list">
                    {KNOWN_ORGANIZER_CLUBS.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  <Button type="button" variant="outline" size="sm" onClick={() => setClubs((p) => [...p, emptyClub()])}>
                    Añadir otro club
                  </Button>
                  <label className="flex items-center gap-2 text-xs text-foreground-secondary">
                    <input type="checkbox" checked={volunteer} onChange={(e) => setVolunteer(e.target.checked)} />
                    Colaborador voluntario
                  </label>
                </>
              )}
            </div>
            <Button type="button" size="sm" className="mt-3" onClick={saveOrganizer} disabled={pending}>
              Guardar organizadores
            </Button>
          </div>
        </section>
      )}

      {readiness && readiness.issues.length > 0 && (
        <div className="flex gap-3 rounded-2xl border border-warning-border bg-warning-subtle px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <ul className="list-inside list-disc space-y-1 text-foreground-secondary">
            {readiness.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={onRecalculate} disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Recalcular funciones</span>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCalculateDistances} disabled={pending || !venueOk}>
              <Navigation className="h-3.5 w-3.5" />
              <span className="ml-1.5">Calcular km (Google)</span>
            </Button>
          </>
        )}
        <div className="ml-auto text-right">
          <p className="font-mono text-sm font-semibold text-foreground">
            Total confirmado:{" "}
            {readiness?.readyForExport
              ? formatReceiptAmountEur(summary?.grandTotal ?? 0)
              : "—"}
          </p>
          {!readiness?.readyForExport && (summary?.provisionalTotal ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              Provisional (sin km): {formatReceiptAmountEur(summary?.provisionalTotal ?? 0)}
            </p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive-muted px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border-muted">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-border-muted bg-surface/50 text-[11px] uppercase tracking-wide text-subtle-muted">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2">Juez</th>
              <th className="px-3 py-2">Funciones</th>
              <th className="px-3 py-2">Km i+v</th>
              <th className="px-3 py-2">Comparte</th>
              <th className="px-3 py-2">Aloj.</th>
              <th className="px-3 py-2">Resp.</th>
              <th className="px-3 py-2 text-right">Total</th>
              {canManage && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => {
              const isOpen = expanded.has(claim.refereeId);
              const breakdown = buildClaimBreakdown(claim);
              return (
                <Fragment key={claim.refereeId}>
                  <tr className="border-b border-border-muted/60">
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => toggleExpanded(claim.refereeId)}
                        aria-label={isOpen ? "Ocultar desglose" : "Ver desglose"}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-medium">{claim.refereeName}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {claim.sessionCount}S + {claim.pesajeCount}P
                    </td>
                    <td className="px-3 py-2">
                      {claim.travelMode === "shared_vehicle_passenger" ? (
                        <span className="text-xs text-muted-foreground">0 (compartido)</span>
                      ) : canManage ? (
                        <Input
                          className="h-8 w-20 font-mono text-xs"
                          type="number"
                          step={1}
                          min={0}
                          inputMode="numeric"
                          value={claim.distanceKmRoundTrip ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              patchClaim(claim.refereeId, {
                                distanceKmRoundTrip: null,
                                distanceKmOneWay: null,
                                distanceSource: null,
                                travelMode: "km_rate",
                              });
                              return;
                            }
                            const v = Math.max(0, Math.round(Number(raw)));
                            if (!Number.isFinite(v)) return;
                            patchClaim(claim.refereeId, {
                              distanceKmRoundTrip: v,
                              distanceKmOneWay: Math.round(v / 2),
                              distanceSource: "manual",
                              travelMode: "km_rate",
                            });
                          }}
                        />
                      ) : (
                        <span className="font-mono text-xs">{claim.distanceKmRoundTrip ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <input
                          type="checkbox"
                          checked={claim.travelMode === "shared_vehicle_passenger"}
                          onChange={(e) =>
                            patchClaim(claim.refereeId, {
                              travelMode: e.target.checked ? "shared_vehicle_passenger" : "km_rate",
                              ...(e.target.checked
                                ? { distanceKmRoundTrip: 0, distanceKmOneWay: 0 }
                                : {}),
                            })
                          }
                          aria-label="Comparte desplazamiento"
                        />
                      ) : claim.travelMode === "shared_vehicle_passenger" ? (
                        "Sí"
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {claim.financialComplete ? formatReceiptAmountEur(claim.lodgingAmount) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <input
                          type="checkbox"
                          checked={claim.isCompetitionManager}
                          onChange={(e) =>
                            patchClaim(claim.refereeId, { isCompetitionManager: e.target.checked })
                          }
                          aria-label="Responsable competición"
                        />
                      ) : claim.isCompetitionManager ? (
                        "Sí"
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {claim.financialComplete ? (
                        formatReceiptAmountEur(claim.totalAmount)
                      ) : (
                        <span className="text-warning" title="Completa los km">
                          pendiente
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs"
                          disabled={!claim.financialComplete}
                          onClick={() => setExportTarget(claim)}
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          Recibo
                        </Button>
                      </td>
                    )}
                  </tr>
                  {isOpen && (
                    <tr className="bg-surface/30">
                      <td colSpan={canManage ? 9 : 8} className="px-4 py-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Desglose · {claim.refereeName}
                        </p>
                        <ul className="space-y-1 text-sm">
                          {breakdown.map((line) => (
                            <li key={`${line.label}-${line.detail ?? ""}`} className="flex justify-between gap-4">
                              <span className="text-foreground-secondary">
                                {line.label}
                                {line.detail ? (
                                  <span className="text-muted-foreground"> · {line.detail}</span>
                                ) : null}
                              </span>
                              <span className="font-mono tabular-nums">{formatReceiptAmountEur(line.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {claims.length === 0 && (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Sin jueces asignados en tarima. Monta la tarima y pulsa recalcular funciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {exportTarget && (
        <CompensationExportDialog
          competitionId={competition.id}
          claim={exportTarget}
          readyForExport={readiness?.readyForExport ?? false}
          onClose={() => setExportTarget(null)}
        />
      )}
    </PageShell>
  );
}
