"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api/config";
import { cn } from "@/lib/utils";

interface RosterRevisionPanelProps {
  competitionId: string;
  filledSlots: number;
  totalSlots: number;
  fillPct: number;
  violationCount: number;
  openSlots: number;
  onGoAssign: () => void;
}

export function RosterRevisionPanel({
  competitionId,
  filledSlots,
  totalSlots,
  fillPct,
  violationCount,
  openSlots,
  onGoAssign,
}: RosterRevisionPanelProps) {
  const ready = fillPct >= 100 && violationCount === 0;
  // Mismo HTML que genera el export/PDF (ruta del cuadrante): así se revisa
  // exactamente lo que se va a sacar, no una aproximación.
  const quadrantUrl = `${getApiBaseUrl()}/competitions/${competitionId}/roster/quadrant`;

  // Se descarga el HTML y se inyecta con srcDoc (no por src): así el preview no
  // depende de las cabeceras de framing (X-Frame-Options / frame-ancestors), que
  // bloqueaban el iframe. `embed=1` oculta el botón flotante de imprimir.
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPreviewHtml(null);
    setPreviewError(false);
    fetch(`${quadrantUrl}?embed=1`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((html) => {
        if (!cancelled) setPreviewHtml(html);
      })
      .catch(() => {
        if (!cancelled) setPreviewError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [quadrantUrl]);

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Revisión antes de enviar</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-3">
          <li className="flex items-center gap-2 rounded-lg border border-border-muted bg-surface/60 px-3 py-2">
            {fillPct >= 100 ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            )}
            <span className="text-xs">
              Cobertura <span className="font-semibold">{filledSlots}/{totalSlots}</span> ({fillPct}%)
            </span>
          </li>
          <li className="flex items-center gap-2 rounded-lg border border-border-muted bg-surface/60 px-3 py-2">
            {openSlots === 0 ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            )}
            <span className="text-xs">
              Huecos sin asignar <span className="font-semibold">{openSlots}</span>
            </span>
          </li>
          <li className="flex items-center gap-2 rounded-lg border border-border-muted bg-surface/60 px-3 py-2">
            {violationCount === 0 ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            )}
            <span className="text-xs">
              Violaciones normativa <span className="font-semibold">{violationCount}</span>
            </span>
          </li>
        </ul>
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            ready
              ? "border-success-border bg-success-muted text-success"
              : "border-warning-border bg-warning-subtle text-warning",
          )}
        >
          {ready
            ? "La tarima cumple los requisitos mínimos. Revisa el cuadrante y envíala a aprobación con el botón superior."
            : "Completa la asignación y corrige violaciones antes de enviar."}
        </p>
        {!ready && (
          <Button type="button" variant="outline" size="sm" onClick={onGoAssign}>
            Volver a asignación
          </Button>
        )}
      </div>

      {/* Vista previa del export tal cual saldrá (mismo HTML que el PDF). */}
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border border-b-0 border-border bg-surface px-3 py-2">
          <p className="text-xs font-semibold text-foreground-secondary">
            Vista previa del export · cuadrante
          </p>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={`${quadrantUrl}?print=1`} target="_blank" rel="noopener noreferrer">
                <Printer className="h-3.5 w-3.5" />
                Imprimir / PDF
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={quadrantUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir
              </a>
            </Button>
          </div>
        </div>
        {previewError ? (
          <div className="flex h-[68vh] w-full flex-col items-center justify-center gap-3 rounded-b-xl border border-border bg-muted/40 text-center">
            <p className="text-sm text-muted-foreground">No se pudo cargar la vista previa.</p>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={quadrantUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir el cuadrante en una pestaña
              </a>
            </Button>
          </div>
        ) : previewHtml === null ? (
          <div className="flex h-[68vh] w-full items-center justify-center rounded-b-xl border border-border bg-muted/40">
            <Loader2 className="h-5 w-5 animate-spin text-subtle-muted" />
          </div>
        ) : (
          <iframe
            srcDoc={previewHtml}
            sandbox="allow-same-origin"
            title="Vista previa del cuadrante que se exportará"
            className="h-[68vh] w-full rounded-b-xl border border-border bg-white"
          />
        )}
      </div>
    </div>
  );
}
