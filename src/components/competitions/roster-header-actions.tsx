"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api/client";
import { formatApiError } from "@/lib/api/error-message";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Download, FileSpreadsheet, FileText, Loader2, MoreHorizontal, Save, Send, Share2 } from "lucide-react";
import { coverageBarClass } from "@/lib/status-tone";

const ExportPreviewDialog = dynamic(
  () => import("@/components/data-transfer/export-preview-dialog").then((m) => m.ExportPreviewDialog),
  { ssr: false },
);
import { getApiBaseUrl } from "@/lib/api/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReactNode, TransitionStartFunction } from "react";
import { confirmar } from "@/components/ui/confirm-dialog";

interface RosterHeaderActionsProps {
  competitionId: string;
  filledSlots: number;
  totalSlots: number;
  fillPct: number;
  violationCount?: number;
  openSlots?: number;
  pending: boolean;
  rosterLocked?: boolean;
  /** Si hay motivo, el envío no puede prosperar: se desactiva y se explica. */
  submitBlockedReason?: string | null;
  statusMsg: string | null;
  statusIsError?: boolean;
  onStatus: (msg: string | null, isError?: boolean) => void;
  startTransition: TransitionStartFunction;
  /** Acciones secundarias de la cabecera que en móvil viven en «Más». */
  moreItems?: ReactNode;
}

/**
 * Menú «Más» de la cabecera en pantallas estrechas. A 390 px las nueve
 * acciones de la tarima caían en cinco filas irregulares; en móvil quedan a
 * la vista el estado (avisos, cobertura) y la acción principal, y el resto
 * entra aquí. Desde `md` no se pinta: la barra completa cabe.
 */
export function RosterMoreMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 px-3 text-xs md:hidden" aria-label="Más acciones">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          Más
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  submitBlockedReason = null,
  statusMsg,
  statusIsError = false,
  onStatus,
  startTransition,
  moreItems,
}: RosterHeaderActionsProps) {
  const [exportOpen, setExportOpen] = useState(false);

  // Mismo tono de cobertura que la lista de campeonatos y las sesiones.
  const coverageBarColor = coverageBarClass(fillPct);

  const guardarBorrador = () => {
    startTransition(async () => {
      try {
        const res = await api.saveDraft(competitionId);
        onStatus(res.message, false);
      } catch (err) {
        onStatus(formatApiError(err, "Error al guardar el borrador"), true);
      }
    });
  };

  // Las mismas salidas en el desplegable «Exportar» (escritorio) y en «Más» (móvil).
  const exportItems = (
    <>
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
    </>
  );

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
    {/* En móvil los dos contenedores se disuelven (`contents`): cobertura,
        «Más» y el envío pasan a la fila de la cabecera, junto al aviso. */}
    <div className="flex flex-col items-start gap-1.5 max-md:contents md:items-end">
      <div className="flex flex-wrap items-center justify-start gap-2 max-md:contents md:justify-end">
        {/* Cobertura como lectura, no como un campo: sin caja de input. */}
        <div
          className="flex h-8 items-center gap-2 px-1"
          title={`Cobertura: ${filledSlots}/${totalSlots} plazas`}
        >
          <span className="text-ui font-medium tabular-nums text-foreground">
            {filledSlots}
            <span className="text-subtle-muted">/{totalSlots}</span>
          </span>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-chart-track">
            <div
              className={cn(
                // Misma ley que las barras de cobertura de las sesiones.
                "h-full rounded-full transition-[width] duration-(--duration-slow) ease-(--ease-out)",
                coverageBarColor,
              )}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 px-2.5 text-xs md:inline-flex"
          disabled={pending || rosterLocked}
          onClick={guardarBorrador}
        >
          Guardar borrador
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden h-8 gap-1.5 px-2.5 text-xs md:inline-flex" disabled={pending}>
              <Download className="h-3.5 w-3.5" />
              Exportar
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {exportItems}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex w-full gap-2 md:contents">
        <RosterMoreMenu>
          {moreItems}
          {moreItems && <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={guardarBorrador} disabled={pending || rosterLocked}>
            <Save className="mr-2 h-3.5 w-3.5" />
            Guardar borrador
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {exportItems}
        </RosterMoreMenu>

        {/* La acción principal: único botón en rojo de marca. */}
        <Button
          size="sm"
          className={cn(
            "h-8 gap-1.5 max-md:h-9 max-md:flex-1 px-2.5 text-xs font-semibold shadow-sm transition-[color,background-color,box-shadow,scale] duration-(--duration-base) ease-(--ease-out)",
            // Tarima completa: se marca con un halo fijo, no con un latido. Este
            // botón está en pantalla toda la sesión de montaje; un bucle infinito
            // ahí deja de informar y pasa a molestar.
            fillPct >= 100 && "ring-2 ring-success/40",
            // Tarima aprobada: en móvil no ocupa la fila un botón muerto; la
            // salida es «Registrar imprevisto», en el aviso de debajo.
            rosterLocked && "max-md:hidden",
          )}
          disabled={pending || rosterLocked || Boolean(submitBlockedReason)}
          title={submitBlockedReason ?? undefined}
          onClick={async () => {
            const lines = [
              `Cobertura: ${fillPct} % (${filledSlots}/${totalSlots} plazas).`,
              openSlots > 0 ? `Huecos sin asignar: ${openSlots}.` : null,
              violationCount > 0 ? `Avisos de normativa: ${violationCount}.` : null,
            ].filter(Boolean);
            const ok = await confirmar({
              titulo: "¿Enviar la propuesta a aprobación?",
              detalle: lines.join("\n"),
              accion: "Enviar a aprobación",
            });
            if (!ok) return;
            startTransition(async () => {
              try {
                const res = await api.submitRoster(competitionId);
                onStatus(res.message, false);
              } catch (err) {
                // El servidor dice qué falta —plantilla sin definir, tarima sin
                // jueces, «quedan 3 huecos», tarima bloqueada—; aquí se tiraba
                // el mensaje y solo quedaba un callejón sin salida.
                onStatus(formatApiError(err, "Error al enviar la propuesta"), true);
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
      </div>

      {(pending || statusMsg) && (
        <p
          className={`text-xs max-md:w-full ${
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
