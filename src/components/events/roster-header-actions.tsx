"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Download, Loader2, Send } from "lucide-react";
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
  statusIsError?: boolean;
  onStatus: (msg: string | null, isError?: boolean) => void;
  startTransition: TransitionStartFunction;
}

export function RosterHeaderActions({
  eventId,
  filledSlots,
  totalSlots,
  fillPct,
  pending,
  statusMsg,
  statusIsError = false,
  onStatus,
  startTransition,
}: RosterHeaderActionsProps) {
  const [exporting, setExporting] = useState(false);

  const coverageBarColor =
    fillPct >= 100 ? "bg-success" : fillPct >= 70 ? "bg-warning" : "bg-chart-danger";

  const handleExport = async () => {
    setExporting(true);
    try {
      window.location.href = api.exportRosterUrl(eventId);
      await new Promise<void>((r) => setTimeout(r, 1200));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Coverage card with ring + bar */}
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-subtle-muted">
              Cobertura
            </p>
            <p className="font-mono text-base font-medium tabular-nums text-foreground">
              {filledSlots}
              <span className="text-subtle-muted">/{totalSlots}</span>
            </p>
            {/* Linear progress bar */}
            <div className="mt-1.5 h-1 w-20 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all duration-500", coverageBarColor)}
                style={{ width: `${fillPct}%` }}
              />
            </div>
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
                onStatus(res.message, false);
              } catch {
                onStatus("Error al guardar el borrador", true);
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
          disabled={pending || exporting}
          onClick={() => void handleExport()}
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {exporting ? "Exportando…" : "Exportar"}
        </Button>

        {/* Highlighted submit button with brand color */}
        <Button
          size="sm"
          className={cn(
            "gap-1.5 font-semibold shadow-sm transition-all",
            fillPct >= 100 && "animate-pulse",
          )}
          disabled={pending}
          onClick={() => {
            if (
              fillPct < 100 &&
              !confirm(
                `El roster está al ${fillPct}% (${filledSlots}/${totalSlots} plazas). ¿Enviar igualmente?`,
              )
            )
              return;
            startTransition(async () => {
              try {
                const res = await api.submitRoster(eventId);
                onStatus(res.message, false);
              } catch {
                onStatus("Error al enviar la propuesta", true);
              }
            });
          }}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : fillPct >= 100 ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Enviar a aprobación
        </Button>
      </div>

      {(pending || statusMsg) && (
        <p
          className={`text-xs ${
            pending
              ? "text-muted-foreground"
              : statusIsError
                ? "text-destructive"
                : "text-success"
          }`}
        >
          {pending ? "Guardando…" : statusMsg}
        </p>
      )}
    </div>
  );
}
