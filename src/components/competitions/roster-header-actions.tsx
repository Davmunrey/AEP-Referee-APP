"use client";

import { useState } from "react";
import { ExportPreviewDialog } from "@/components/data-transfer/export-preview-dialog";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Download, FileSpreadsheet, FileText, Loader2, Send, Share2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api/config";
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
  competitionId: string;
  filledSlots: number;
  totalSlots: number;
  fillPct: number;
  violationCount?: number;
  openSlots?: number;
  pending: boolean;
  statusMsg: string | null;
  statusIsError?: boolean;
  onStatus: (msg: string | null, isError?: boolean) => void;
  startTransition: TransitionStartFunction;
}

export function RosterHeaderActions({
  competitionId,
  filledSlots,
  totalSlots,
  fillPct,
  violationCount = 0,
  openSlots = 0,
  pending,
  statusMsg,
  statusIsError = false,
  onStatus,
  startTransition,
}: RosterHeaderActionsProps) {
  const [exportOpen, setExportOpen] = useState(false);

  const coverageBarColor =
    fillPct >= 100 ? "bg-success" : fillPct >= 70 ? "bg-warning" : "bg-chart-danger";

  const exportFilename = `acta-tarima-${competitionId}.txt`;

  return (
    <>
      <ExportPreviewDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        kind="roster_export"
        fetchText={() => api.fetchRosterExportText(competitionId)}
        filename={exportFilename}
        mime="text/plain;charset=utf-8"
        summaryStats={[
          {
            label: "Cobertura",
            value: `${fillPct}%`,
            tone: fillPct >= 100 ? "success" : undefined,
          },
          { label: "Plazas", value: `${filledSlots}/${totalSlots}` },
          {
            label: "Huecos",
            value: openSlots,
            tone: openSlots > 0 ? "warning" : undefined,
          },
          {
            label: "Violaciones",
            value: violationCount,
            tone: violationCount > 0 ? "warning" : undefined,
          },
        ]}
      />
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {/* Coverage card with ring + bar */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-subtle-muted">
              Cobertura
            </p>
            <p className="font-mono text-sm font-medium tabular-nums text-foreground">
              {filledSlots}
              <span className="text-subtle-muted">/{totalSlots}</span>
            </p>
            {/* Linear progress bar */}
            <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-muted">
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
          className="h-8 px-2.5 text-xs"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              try {
                const res = await api.saveDraft(competitionId);
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
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={pending}
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-3.5 w-3.5" />
          Exportar
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={pending}
          onClick={() => {
            window.open(
              `${getApiBaseUrl()}/competitions/${competitionId}/roster/quadrant`,
              "_blank",
            );
          }}
        >
          <FileText className="h-3.5 w-3.5" />
          Cuadrante PDF
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={pending}
          onClick={() => {
            window.open(
              `${getApiBaseUrl()}/competitions/${competitionId}/roster/quadrant.xlsx`,
              "_blank",
            );
          }}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Excel
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          disabled={pending}
          onClick={() => {
            const url = `${getApiBaseUrl()}/competitions/${competitionId}/roster/quadrant`;
            const msg =
              `Cuadrante de jueces — ${fillPct}% cubierto (${filledSlots}/${totalSlots} plazas)` +
              (openSlots > 0 ? `, ${openSlots} huecos` : "") +
              `.\nCuadrante: ${url}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
          }}
        >
          <Share2 className="h-3.5 w-3.5" />
          WhatsApp
        </Button>

        {/* Highlighted submit button with brand color */}
        <Button
          size="sm"
          className={cn(
            "h-8 gap-1.5 px-2.5 text-xs font-semibold shadow-sm transition-all",
            fillPct >= 100 && "animate-pulse",
          )}
          disabled={pending}
          onClick={() => {
            const lines = [
              `Cobertura: ${fillPct}% (${filledSlots}/${totalSlots} plazas).`,
              openSlots > 0 ? `Huecos sin asignar: ${openSlots}.` : null,
              violationCount > 0
                ? `Violaciones de normativa: ${violationCount}.`
                : null,
              "¿Enviar la propuesta a aprobación?",
            ].filter(Boolean);
            if (!confirm(lines.join("\n"))) return;
            startTransition(async () => {
              try {
                const res = await api.submitRoster(competitionId);
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
    </>
  );
}
