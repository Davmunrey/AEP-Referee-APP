"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { buildClaimBreakdown, groupDutiesBySession } from "@/lib/judge-compensation/breakdown";
import { isValidSpanishIban } from "@/lib/judge-compensation/iban";
import { formatReceiptAmountEur } from "@/lib/judge-compensation/receipt-document";
import type { CompensationClaim } from "@/lib/judge-compensation/types";

interface CompensationExportDialogProps {
  competitionId: string;
  claim: CompensationClaim;
  readyForExport: boolean;
  onClose: () => void;
}

export function CompensationExportDialog({
  competitionId,
  claim,
  readyForExport,
  onClose,
}: CompensationExportDialogProps) {
  const [iban, setIban] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const extras = buildClaimBreakdown(claim).filter((line) => !line.group);

  const onExport = () => {
    setError(null);
    if (!readyForExport || !claim.financialComplete) {
      setError("Completa todos los km antes de exportar");
      return;
    }
    if (!isValidSpanishIban(iban)) {
      setError("IBAN español no válido");
      return;
    }
    startTransition(async () => {
      try {
        const blob = await api.exportCompensationReceipt(competitionId, claim.refereeId, iban);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `compensacion_${claim.refereeName.replace(/\s+/g, "_")}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al exportar");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Exportar recibo</h3>
            <p className="mt-1 text-xs text-muted-foreground">{claim.refereeName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4 text-subtle-muted" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-border-muted bg-surface/50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Desglose</p>
          <ul className="space-y-2 text-sm">
            {groupDutiesBySession(claim.dutyLines).map((group) => (
              <li key={group.session} className="rounded-lg border border-border-muted/70 bg-background/40 px-2.5 py-2">
                <p className="mb-1 font-semibold text-foreground">{group.label}</p>
                <ul className="space-y-0.5">
                  {group.lines.map((line) => (
                    <li key={`${group.session}-${line.kind}`} className="flex justify-between gap-3 text-foreground-secondary">
                      <span>{line.kind === "pesaje" ? "Pesaje" : "Ordenador"}</span>
                      <span className="font-mono tabular-nums">{formatReceiptAmountEur(line.amount)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {extras.map((line) => (
              <li key={`${line.label}-${line.detail ?? ""}`} className="flex justify-between gap-3 border-t border-border-muted/60 pt-2">
                <span className="text-foreground-secondary">
                  {line.label}
                  {line.detail ? <span className="text-muted-foreground"> · {line.detail}</span> : null}
                </span>
                <span className="font-mono tabular-nums">{formatReceiptAmountEur(line.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border-muted pt-2 text-right font-mono font-semibold">
            Total: {formatReceiptAmountEur(claim.totalAmount)}
          </p>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          El IBAN solo se usa para generar el PDF y no se almacena en la aplicación.
        </p>
        <Input
          placeholder="ES00 0000 0000 0000 0000 0000"
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
        />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button type="button" onClick={onExport} disabled={pending || !iban.trim() || !claim.financialComplete}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Descargar PDF"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
