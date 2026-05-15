"use client";

import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Check, Download } from "lucide-react";
import type { TransitionStartFunction } from "react";

function CoverageRing({ pct }: { pct: number }) {
  const stroke =
    pct >= 100 ? "var(--chart-success)" : pct >= 70 ? "var(--chart-warning)" : "var(--chart-danger)";
  const dash = (pct / 100) * 94.2;

  return (
    <div className="relative h-10 w-10">
      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--chart-track)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} 94.2`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-semibold tabular-nums text-foreground">
        {pct}%
      </span>
    </div>
  );
}

interface RosterHeaderActionsProps {
  eventId: string;
  filledSlots: number;
  totalSlots: number;
  fillPct: number;
  pending: boolean;
  statusMsg: string | null;
  onStatus: (msg: string | null) => void;
  startTransition: TransitionStartFunction;
}

export function RosterHeaderActions({
  eventId,
  filledSlots,
  totalSlots,
  fillPct,
  pending,
  statusMsg,
  onStatus,
  startTransition,
}: RosterHeaderActionsProps) {
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-subtle-muted">
              Cobertura
            </p>
            <p className="font-mono text-base font-medium tabular-nums text-foreground">
              {filledSlots}
              <span className="text-subtle-muted">/{totalSlots}</span>
            </p>
          </div>
          <CoverageRing pct={fillPct} />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              try {
                const res = await api.saveDraft(eventId);
                onStatus(res.message);
              } catch {
                onStatus("Error al guardar el borrador");
              }
            });
          }}
        >
          Guardar borrador
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          asChild
        >
          <a href={api.exportRosterUrl(eventId)} download>
            <Download className="h-3.5 w-3.5" />
            Exportar
          </a>
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              try {
                const res = await api.submitRoster(eventId);
                onStatus(res.message);
              } catch {
                onStatus("Error al enviar la propuesta");
              }
            });
          }}
        >
          <Check className="h-3.5 w-3.5" />
          Enviar a aprobación
        </Button>
      </div>
      {(pending || statusMsg) && (
        <p className="text-xs text-warning/90">{pending ? "Guardando…" : statusMsg}</p>
      )}
    </div>
  );
}
