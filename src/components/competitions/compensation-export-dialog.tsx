"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { isValidSpanishIban } from "@/lib/judge-compensation/iban";
import type { CompensationClaim } from "@/lib/judge-compensation/types";

interface CompensationExportDialogProps {
  competitionId: string;
  claim: CompensationClaim;
  onClose: () => void;
}

export function CompensationExportDialog({
  competitionId,
  claim,
  onClose,
}: CompensationExportDialogProps) {
  const [iban, setIban] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onExport = () => {
    setError(null);
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
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Exportar recibo</h3>
            <p className="mt-1 text-xs text-muted-foreground">{claim.refereeName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4 text-subtle-muted" />
          </button>
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
          <Button type="button" onClick={onExport} disabled={pending || !iban.trim()}>
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
