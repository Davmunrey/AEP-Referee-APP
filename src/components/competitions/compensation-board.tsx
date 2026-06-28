"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { api } from "@/lib/api/client";
import { formatReceiptAmountEur } from "@/lib/judge-compensation/receipt-document";
import type { CompensationClaim } from "@/lib/judge-compensation/types";
import type { Competition } from "@/lib/types";
import { selectFieldClass } from "@/lib/design-tokens";
import { CompensationExportDialog } from "./compensation-export-dialog";

interface CompensationBoardProps {
  competition: Competition;
  canManage: boolean;
}

export function CompensationBoard({ competition, canManage }: CompensationBoardProps) {
  const [claims, setClaims] = useState<CompensationClaim[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [exportTarget, setExportTarget] = useState<CompensationClaim | null>(null);
  const [organizer, setOrganizer] = useState(competition.compensationOrganizer ?? "club");
  const [clubName, setClubName] = useState(competition.compensationClubName ?? "");
  const [clubEmail, setClubEmail] = useState(competition.compensationClubEmail ?? "");
  const [volunteer, setVolunteer] = useState(competition.compensationVolunteer ?? false);

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        setError(null);
        const summary = await api.getCompensation(competition.id);
        setClaims(summary.claims);
        setGrandTotal(summary.grandTotal);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar compensación");
      }
    });
  }, [competition.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRecalculate = () => {
    startTransition(async () => {
      try {
        setError(null);
        const summary = await api.recalculateCompensation(competition.id);
        setClaims(summary.claims);
        setGrandTotal(summary.grandTotal);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al recalcular");
      }
    });
  };

  const saveOrganizer = () => {
    startTransition(async () => {
      try {
        await api.updateCompetition(competition.id, {
          compensationOrganizer: organizer as Competition["compensationOrganizer"],
          compensationClubName: clubName || undefined,
          compensationClubEmail: clubEmail || undefined,
          compensationVolunteer: volunteer,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar organizador");
      }
    });
  };

  const patchClaim = (refereeId: string, patch: Parameters<typeof api.updateCompensationClaim>[2]) => {
    startTransition(async () => {
      try {
        const updated = await api.updateCompensationClaim(competition.id, refereeId, patch);
        setClaims((prev) => prev.map((c) => (c.refereeId === refereeId ? updated : c)));
        setGrandTotal((prev) => {
          const old = claims.find((c) => c.refereeId === refereeId)?.totalAmount ?? 0;
          return Math.round((prev - old + updated.totalAmount) * 100) / 100;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  };

  return (
    <PageShell>
      <div className="mb-3">
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
        <section className="glass-panel mb-4 rounded-2xl border border-border-muted p-4">
          <h2 className="text-sm font-semibold text-foreground">Organizador del recibo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Define cabecera y e-mail de devolución. El IBAN no se guarda en la app.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              className={selectFieldClass}
              value={organizer}
              aria-label="Tipo organizador"
              onChange={(e) => setOrganizer(e.target.value as "club" | "aep")}
            >
              <option value="club">Club organizador</option>
              <option value="aep">AEP nacional</option>
            </select>
            {organizer === "club" && (
              <>
                <Input
                  placeholder="Nombre del club"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                />
                <Input
                  type="email"
                  placeholder="Email devolución recibo"
                  value={clubEmail}
                  onChange={(e) => setClubEmail(e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs text-foreground-secondary">
                  <input
                    type="checkbox"
                    checked={volunteer}
                    onChange={(e) => setVolunteer(e.target.checked)}
                  />
                  Colaborador voluntario
                </label>
              </>
            )}
          </div>
          <Button type="button" size="sm" className="mt-3" onClick={saveOrganizer} disabled={pending}>
            Guardar organizador
          </Button>
        </section>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {canManage && (
          <Button type="button" size="sm" variant="outline" onClick={onRecalculate} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Recalcular desde tarima</span>
          </Button>
        )}
        <span className="ml-auto font-mono text-sm font-semibold text-foreground">
          Total: {formatReceiptAmountEur(grandTotal)}
        </span>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border-muted">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border-muted bg-surface/50 text-[11px] uppercase tracking-wide text-subtle-muted">
            <tr>
              <th className="px-3 py-2">Juez</th>
              <th className="px-3 py-2">Funciones</th>
              <th className="px-3 py-2">Km i+v</th>
              <th className="px-3 py-2">Aloj.</th>
              <th className="px-3 py-2">Resp.</th>
              <th className="px-3 py-2 text-right">Total</th>
              {canManage && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr key={claim.refereeId} className="border-b border-border-muted/60">
                <td className="px-3 py-2 font-medium">{claim.refereeName}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {claim.sessionCount}S + {claim.pesajeCount}P
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <Input
                      className="h-8 w-20 font-mono text-xs"
                      type="number"
                      step="0.1"
                      value={claim.distanceKmRoundTrip ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        patchClaim(claim.refereeId, {
                          distanceKmRoundTrip: v,
                          distanceKmOneWay: v != null ? v / 2 : null,
                          distanceSource: "manual",
                        });
                      }}
                    />
                  ) : (
                    <span className="font-mono text-xs">{claim.distanceKmRoundTrip ?? "—"}</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{formatReceiptAmountEur(claim.lodgingAmount)}</td>
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
                  ) : (
                    claim.isCompetitionManager ? "Sí" : "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {formatReceiptAmountEur(claim.totalAmount)}
                </td>
                {canManage && (
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      onClick={() => setExportTarget(claim)}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Recibo
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Sin jueces asignados en tarima. Monta la tarima y pulsa recalcular.
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
          onClose={() => setExportTarget(null)}
        />
      )}
    </PageShell>
  );
}
