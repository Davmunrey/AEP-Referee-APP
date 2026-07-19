"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { buildClaimBreakdown, groupDutiesBySession } from "@/lib/judge-compensation/breakdown";
import {
  formatIbanInput,
  getSpanishIbanValidationHint,
  isValidSpanishIban,
} from "@/lib/judge-compensation/iban";
import { formatReceiptAmountEur } from "@/lib/judge-compensation/receipt-document";
import type { CompensationClaim } from "@/lib/judge-compensation/types";
import { downloadPdfBlob } from "@/lib/import-export-ui";

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

  const ibanHint = useMemo(() => getSpanishIbanValidationHint(iban), [iban]);
  const ibanReady = isValidSpanishIban(iban);

  const onExport = () => {
    setError(null);
    if (!readyForExport || !claim.financialComplete) {
      setError("Completa todos los km antes de exportar");
      return;
    }
    if (!ibanReady) {
      setError(ibanHint ?? "IBAN español no válido");
      return;
    }
    startTransition(async () => {
      try {
        const blob = await api.exportCompensationReceipt(competitionId, claim.refereeId, iban);
        const filename = `compensacion_${claim.refereeName.replace(/\s+/g, "_")}.pdf`;
        downloadPdfBlob(blob, filename);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al exportar");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="export-receipt-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 id="export-receipt-title" className="text-sm font-semibold">Exportar recibo</h3>
            <p className="mt-1 text-xs text-muted-foreground">{claim.refereeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-subtle-muted transition-colors hover:bg-surface-hover hover:text-foreground focus-ring"
          >
            <X className="h-4 w-4" />
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
                    <li key={`${group.session}-${line.roleLabel}`} className="flex justify-between gap-3 text-foreground-secondary">
                      <span>{line.roleLabel}</span>
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

        <label className="mb-2 block text-xs font-semibold text-foreground-secondary" htmlFor="compensation-export-iban">
          IBAN de devolución
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          Solo se usa para el PDF y no se guarda en la aplicación.
        </p>
        <Input
          id="compensation-export-iban"
          placeholder="ES00 0000 0000 0000 0000 0000"
          value={iban}
          onChange={(e) => {
            setIban(formatIbanInput(e.target.value));
            setError(null);
          }}
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          aria-invalid={iban.length > 0 && !ibanReady}
        />
        {ibanHint && <p className="mt-2 text-xs text-destructive">{ibanHint}</p>}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onExport}
            disabled={pending || !ibanReady || !claim.financialComplete}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Descargar PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}
