"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Send, Share2 } from "lucide-react";

const ExportPreviewDialog = dynamic(
  () => import("@/components/data-transfer/export-preview-dialog").then((m) => m.ExportPreviewDialog),
  { ssr: false },
);
import { getApiBaseUrl } from "@/lib/api/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TransitionStartFunction } from "react";

interface RosterHeaderActionsProps {
  competitionId: string;
  filledSlots: number;
  totalSlots: number;
  fillPct: number;
  violationCount?: number;
  openSlots?: number;
  pending: boolean;
  rosterLocked?: boolean;
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
  rosterLocked = false,
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
      {exportOpen && (
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
      )}
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Coverage card: plazas + barra de progreso */}
        <div
          className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5"
          title={`Cobertura: ${filledSlots}/${totalSlots} plazas`}
        >
          <span className="font-mono text-xs font-medium tabular-nums text-foreground">
            {filledSlots}
            <span className="text-subtle-muted">/{totalSlots}</span>
          </span>
          <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-500", coverageBarColor)}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          disabled={pending || rosterLocked}
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" disabled={pending}>
              <Download className="h-3.5 w-3.5" />
              Exportar
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onSelect={() =>
                window.open(`${getApiBaseUrl()}/competitions/${competitionId}/roster/quadrant?print=1`, "_blank")
              }
            >
              <FileText className="mr-2 h-3.5 w-3.5" />
              Cuadrante PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                window.open(`${getApiBaseUrl()}/competitions/${competitionId}/roster/quadrant.xlsx`, "_blank")
              }
            >
              <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
              Cuadrante Excel
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setExportOpen(true)}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Acta (texto)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const url = `${getApiBaseUrl()}/competitions/${competitionId}/roster/quadrant`;
                const msg =
                  `Cuadrante de jueces — ${fillPct}% cubierto (${filledSlots}/${totalSlots} plazas)` +
                  (openSlots > 0 ? `, ${openSlots} huecos` : "") +
                  `.\nCuadrante: ${url}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
              }}
            >
              <Share2 className="mr-2 h-3.5 w-3.5" />
              Compartir WhatsApp
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Highlighted submit button with brand color */}
        <Button
          size="sm"
          className={cn(
            "h-8 gap-1.5 px-2.5 text-xs font-semibold shadow-sm transition-all",
            fillPct >= 100 && "animate-pulse",
          )}
          disabled={pending || rosterLocked}
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
