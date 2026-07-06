"use client";

import { useCallback, useEffect, useRef, useState, useTransition, Fragment } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileDown,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { api } from "@/lib/api/client";
import {
  buildClaimBreakdown,
  formatDutySessionsSummary,
  groupDutiesBySession,
} from "@/lib/judge-compensation/breakdown";
import { formatReceiptAmountEur } from "@/lib/judge-compensation/receipt-document";
import type { CompensationClaim, CompensationClubContact, CompetitionCompensationSummary } from "@/lib/judge-compensation/types";
import { allClubEmailsFromCompetition, assessCompensationReadiness, competitionClubContacts } from "@/lib/judge-compensation/readiness";
import { applyCompensationClaimPatch } from "@/lib/judge-compensation/claim-patch";
import type { CompensationClaimPatch } from "@/lib/api/client-compensation";
import { KNOWN_ORGANIZER_CLUBS, normalizeClubEmails, suggestedEmailsForClubName } from "@/lib/organizer-clubs";
import type { Competition } from "@/lib/types";
import { selectFieldClass } from "@/lib/design-tokens";
import { CompensationEuroInput, CompensationKmInput } from "./compensation-numeric-inputs";

const CompensationExportDialog = dynamic(
  () => import("./compensation-export-dialog").then((m) => m.CompensationExportDialog),
  { ssr: false },
);

interface CompensationBoardProps {
  competition: Competition;
  canManage: boolean;
}

function emptyClub(): CompensationClubContact {
  return { name: "", emails: [] };
}

function applyClaimUpdate(
  prev: CompetitionCompensationSummary,
  updated: CompensationClaim,
  competition: Competition,
): CompetitionCompensationSummary {
  const claims = prev.claims.map((c) => (c.refereeId === updated.refereeId ? updated : c));
  const grandTotal = claims
    .filter((c) => c.financialComplete)
    .reduce((sum, c) => sum + c.totalAmount, 0);
  const provisionalTotal = claims.reduce((sum, c) => sum + c.totalAmount, 0);
  const readiness = assessCompensationReadiness({
    competition,
    claims,
    refereesById: new Map(),
    organizerIsClub: (competition.compensationOrganizer ?? "club") === "club",
    clubEmails: allClubEmailsFromCompetition(competition),
  });
  return {
    ...prev,
    claims,
    grandTotal: Math.round(grandTotal * 100) / 100,
    provisionalTotal: Math.round(provisionalTotal * 100) / 100,
    readiness,
  };
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
  const patchChainRef = useRef(Promise.resolve());

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

  const patchClaim = useCallback(
    (refereeId: string, patch: CompensationClaimPatch) => {
      setSummary((prev) => {
        if (!prev) return prev;
        const existing = prev.claims.find((c) => c.refereeId === refereeId);
        if (!existing) return prev;
        const optimistic = applyCompensationClaimPatch(existing, patch);
        return applyClaimUpdate(prev, optimistic, competition);
      });

      const run = patchChainRef.current
        .then(async () => {
          const updated = await api.updateCompensationClaim(competition.id, refereeId, patch);
          setSummary((prev) => (prev ? applyClaimUpdate(prev, updated, competition) : prev));
          setError(null);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "No se pudo guardar");
          load();
        });
      patchChainRef.current = run;
    },
    [competition, load],
  );

  const toggleExpanded = (refereeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(refereeId)) next.delete(refereeId);
      else next.add(refereeId);
      return next;
    });
  };

  return (
    <PageShell className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link href="/compensation">
            <ArrowLeft className="h-3.5 w-3.5" />
            Panel compensación
          </Link>
        </Button>
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
            <h2 className="text-sm font-semibold text-foreground">Organizadores del recibo</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Puede haber varios clubes y varios e-mails de devolución (separados por coma). Escribe los km
              ida+vuelta (solo números) y pulsa Enter o sal del campo para guardar.
            </p>
            <div className="mt-3 space-y-3">
              <select
                className={selectFieldClass}
                value={organizer}
                aria-label="Tipo organizador"
                onChange={(e) => setOrganizer(e.target.value as "club" | "aep" | "custom")}
              >
                <option value="club">Club(es) organizador(es)</option>
                <option value="aep">Asociación Española de Powerlifting</option>
                <option value="custom">Personalizable (nombres y correos)</option>
              </select>

              {(organizer === "club" || organizer === "custom") && (
                <>
                  {clubs.map((club, index) => (
                    <div key={index} className="grid gap-2 rounded-xl border border-border-muted bg-surface/40 p-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {organizer === "custom" ? "Nombre" : "Club"} {clubs.length > 1 ? index + 1 : ""}
                        </label>
                        <Input
                          list="organizer-clubs-list"
                          placeholder="Nombre del club"
                          value={club.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setClubs((prev) =>
                              prev.map((c, i) => {
                                if (i !== index) return c;
                                const suggested = suggestedEmailsForClubName(name);
                                const emails =
                                  suggested.length > 0 && c.emails.length === 0 ? suggested : c.emails;
                                return { ...c, name, emails };
                              }),
                            );
                          }}
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
                          {organizer === "custom" ? "Quitar" : "Quitar club"}
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
                    {organizer === "custom" ? "Añadir otro nombre" : "Añadir otro club"}
                  </Button>
                  {organizer === "club" && (
                    <label className="flex items-center gap-2 text-xs text-foreground-secondary">
                      <input type="checkbox" checked={volunteer} onChange={(e) => setVolunteer(e.target.checked)} />
                      Colaborador voluntario
                    </label>
                  )}
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
          <Button type="button" size="sm" variant="outline" onClick={onRecalculate} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Recalcular funciones</span>
          </Button>
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
              <th
                className="px-3 py-2"
                title="Montaje del sistema informático (Liftingcast / OpenLifter / Goodlift). No es la posición ordenador en tarima."
              >
                Mont.
              </th>
              <th className="px-3 py-2 text-right">Total</th>
              {canManage && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => {
              const isOpen = expanded.has(claim.refereeId);
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
                    <td className="px-3 py-2 font-mono text-xs text-foreground-secondary">
                      {formatDutySessionsSummary(claim)}
                    </td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <CompensationKmInput
                          valueKm={claim.distanceKmRoundTrip}
                          label={`Kilometraje ida y vuelta de ${claim.refereeName}`}
                          onCommit={(km) => {
                            if (km === null) {
                              patchClaim(claim.refereeId, {
                                distanceKmRoundTrip: null,
                                distanceKmOneWay: null,
                                distanceSource: null,
                              });
                              return;
                            }
                            patchClaim(claim.refereeId, {
                              distanceKmRoundTrip: km,
                              distanceKmOneWay: Math.round(km / 2),
                              distanceSource: "manual",
                            });
                          }}
                        />
                      ) : (
                        <span className="font-mono text-xs">{claim.distanceKmRoundTrip ?? "—"}</span>
                      )}
                      {claim.travelMode === "shared_vehicle_passenger" && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">sin cobro km</p>
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
                            })
                          }
                          aria-label="Comparte desplazamiento (solo exime kilometraje)"
                          title="Solo exime el cobro de kilometraje; el alojamiento sigue aplicando según los km"
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
                    <td className="px-3 py-2">
                      {canManage ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={claim.isComputerSetup}
                            onChange={(e) =>
                              patchClaim(claim.refereeId, {
                                isComputerSetup: e.target.checked,
                                computerSetupAmount: e.target.checked ? claim.computerSetupAmount || null : null,
                              })
                            }
                            aria-label="Montaje del sistema informático"
                            title="Montaje del sistema (Liftingcast / OpenLifter / Goodlift). Distinto de ocupar la posición ordenador en tarima."
                          />
                          {claim.isComputerSetup && (
                            <CompensationEuroInput
                              valueEur={claim.computerSetupAmount}
                              label={`Importe montaje sistema de ${claim.refereeName}`}
                              onCommit={(amount) => {
                                patchClaim(claim.refereeId, {
                                  isComputerSetup: true,
                                  computerSetupAmount: amount,
                                });
                              }}
                            />
                          )}
                        </div>
                      ) : claim.isComputerSetup ? (
                        <span className="font-mono text-xs">
                          {(claim.computerSetupAmount ?? 0) > 0
                            ? formatReceiptAmountEur(claim.computerSetupAmount ?? 0)
                            : "Sí"}
                        </span>
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
                      <td colSpan={canManage ? 10 : 9} className="px-4 py-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Desglose · {claim.refereeName}
                        </p>
                        <ul className="space-y-3 text-sm">
                          {groupDutiesBySession(claim.dutyLines).map((group) => (
                            <li key={group.session} className="rounded-lg border border-border-muted/80 bg-background/50 px-3 py-2">
                              <p className="mb-1.5 font-semibold text-foreground">{group.label}</p>
                              <ul className="space-y-1">
                                {group.lines.map((line) => (
                                  <li
                                    key={`${group.session}-${line.roleLabel}`}
                                    className="flex justify-between gap-4 text-foreground-secondary"
                                  >
                                    <span>
                                      {line.roleLabel}
                                      <span className="text-muted-foreground">
                                        {" "}
                                        · {formatReceiptAmountEur(line.unitAmount)}
                                      </span>
                                    </span>
                                    <span className="font-mono tabular-nums">{formatReceiptAmountEur(line.amount)}</span>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ))}
                          {buildClaimBreakdown(claim)
                            .filter((line) => !line.group)
                            .map((line) => (
                              <li key={`${line.label}-${line.detail ?? ""}`} className="flex justify-between gap-4 border-t border-border-muted/60 pt-2">
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
