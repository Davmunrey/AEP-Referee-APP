"use client";

import { useMemo, useState } from "react";
import type {
  AssignmentsMap,
  FlagsMap,
  CrossZoneMap,
  Referee,
  SlotFlags,
  RoleKey,
  RegulationRule,
  RosterRole,
} from "@/lib/types";
import { AlertTriangle, CheckCheck, Lock, X } from "lucide-react";
import { LevelBadge } from "@/components/aep/badges";
import { abbreviateRefereeLevel } from "@/lib/referee-level-label";
import { cn } from "@/lib/utils";
import type { DesignacionRespuesta } from "@/lib/convocatorias";
import {
  buildCompetitionSlotLayout,
  buildPesajeSlotLayout,
  type SlotCellRef,
} from "@/lib/roster-slot-layout";

export interface SlotGridProps {
  sesion: string;
  roles: RosterRole[];
  assignments: AssignmentsMap;
  flags: FlagsMap;
  crossZoneMap?: CrossZoneMap;
  /** Jueces con la liquidación pagada: su puesto no se puede tocar. */
  paidRefereeIds?: ReadonlySet<string>;
  /** Respuesta de cada juez a su designación (tarima aprobada). */
  respuestas?: Readonly<Record<string, DesignacionRespuesta>>;
  getReferee: (id: string) => Referee | undefined;
  selectedSlot: string | null;
  onSelectSlot: (key: string | null) => void;
  onDrop: (slotKey: string, refereeId: string) => void;
  onClear: (slotKey: string) => void;
  onToggleFlag: (slotKey: string, field: keyof SlotFlags) => void;
  checkViolation: (roleKey: RoleKey, refereeId: string) => RegulationRule | undefined;
  readOnly: boolean;
  isDragging: boolean;
  /** Pesaje usa el mismo grid de 3 columnas con roles de pesaje. */
  variant?: "competition" | "pesaje";
}

const EMPTY_PAID_IDS: ReadonlySet<string> = new Set<string>();
const EMPTY_RESPUESTAS: Readonly<Record<string, DesignacionRespuesta>> = {};

function slotKeyFor(sesion: string, cell: SlotCellRef): string {
  return `${sesion}_${cell.role.key}_${cell.slotIndex}`;
}

function SlotCell({
  sesion,
  cell,
  assignments,
  flags,
  crossZoneMap,
  paidRefereeIds,
  respuestas,
  getReferee,
  selectedSlot,
  onSelectSlot,
  onDrop,
  onClear,
  onToggleFlag,
  checkViolation,
  readOnly,
  isDragging,
  dragOverKey,
  setDragOverKey,
}: {
  sesion: string;
  cell: SlotCellRef;
  assignments: AssignmentsMap;
  flags: FlagsMap;
  crossZoneMap: CrossZoneMap;
  paidRefereeIds: ReadonlySet<string>;
  respuestas: Readonly<Record<string, DesignacionRespuesta>>;
  getReferee: (id: string) => Referee | undefined;
  selectedSlot: string | null;
  onSelectSlot: (key: string | null) => void;
  onDrop: (slotKey: string, refereeId: string) => void;
  onClear: (slotKey: string) => void;
  onToggleFlag: (slotKey: string, field: keyof SlotFlags) => void;
  checkViolation: (roleKey: RoleKey, refereeId: string) => RegulationRule | undefined;
  readOnly: boolean;
  isDragging: boolean;
  dragOverKey: string | null;
  setDragOverKey: (key: string | null) => void;
}) {
  const slotKey = slotKeyFor(sesion, cell);
  const refereeId = assignments[slotKey];
  const referee = refereeId ? getReferee(refereeId) : undefined;
  const isSelected = selectedSlot === slotKey;
  const isDropTarget = dragOverKey === slotKey;
  const violation = refereeId ? checkViolation(cell.role.key, refereeId) : undefined;
  const slotFlags = flags[slotKey];
  const isCrossZone = !!crossZoneMap[slotKey];
  // Con la liquidación pagada el puesto queda congelado: el servidor rechaza
  // la sustitución, así que conviene verlo antes de intentarla.
  const isPaid = !!refereeId && paidRefereeIds.has(refereeId);
  const respuesta = refereeId ? respuestas[refereeId] : undefined;
  const slotLabel =
    cell.role.slots > 1 ? `${cell.role.rol} ${cell.slotIndex + 1}` : cell.role.rol;

  return (
    <div className="min-w-0">
      <p className="mb-1 truncate text-2xs font-medium text-subtle">
        {slotLabel}
      </p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverKey(slotKey);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOverKey(slotKey);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverKey(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverKey(null);
          const id = e.dataTransfer.getData("text/plain");
          if (id) onDrop(slotKey, id);
        }}
        onClick={() => {
          if (readOnly) return;
          onSelectSlot(isSelected ? null : slotKey);
        }}
        role="button"
        tabIndex={readOnly ? -1 : 0}
        onKeyDown={(e) => {
          if (readOnly) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectSlot(isSelected ? null : slotKey);
          }
        }}
        className={cn(
          // El hueco es la contraparte física de la ficha: misma duración y misma
          // curva que ella, y solo propiedades que no repintan layout (la parrilla
          // entera está viva mientras se arrastra).
          "relative rounded-lg border px-2 py-1.5 transition-[color,background-color,border-color,box-shadow,scale] duration-(--duration-fast) ease-(--ease-out) focus-ring",
          !readOnly && "cursor-pointer",
          isDropTarget
            // Crece un 1.5% bajo el puntero: el hueco "acepta" antes de soltar.
            // `z-(--z-sticky)` para que crezca por encima de sus vecinos, no por debajo.
            ? "z-(--z-sticky) scale-(--scale-lift) border-primary bg-primary/10 shadow-md"
            : isSelected
              ? "border-primary bg-primary/5 shadow-sm"
              : violation
                ? "border-warning-border bg-warning-subtle"
                : referee
                  ? "border-border bg-card shadow-sm hover:border-border-strong"
                  : isDragging
                    ? "border-dashed border-success/50 bg-success/5 hover:border-success hover:bg-success/10"
                    : "border-dashed border-border-strong bg-background/50 hover:border-primary/50 hover:bg-primary/5",
        )}
      >
        {referee ? (
          // Una sola fila: nivel, nombre, avisos y acciones. Antes eran tres
          // (nombre, insignias y botones diminutos de 20 px).
          <div className="flex min-h-7 items-center gap-1.5">
            <LevelBadge level={referee.nivel} compact />
            <p className="min-w-0 flex-1 truncate text-ui font-medium leading-tight text-foreground">
              {referee.nombre}
            </p>
            {isCrossZone && (
              <span
                title={`Fuera de zona (${referee.zona})`}
                className="shrink-0 rounded-md bg-warning-muted px-1 py-px text-2xs font-semibold text-warning"
              >
                ⟳
              </span>
            )}
            {isPaid && (
              <span
                title="Liquidación pagada: no se puede sustituir ni liberar este puesto"
                className="flex shrink-0 items-center gap-0.5 rounded-md bg-muted px-1 py-px text-2xs font-medium text-muted-foreground"
              >
                <Lock className="h-3 w-3" aria-hidden="true" />
                Pagada
              </span>
            )}
            {respuesta?.estado === "rechazada" && (
              <span
                title={`No puede ir${respuesta.motivo ? `: ${respuesta.motivo}` : ""}`}
                className="shrink-0 rounded-md bg-destructive-muted px-1 py-px text-2xs font-semibold text-destructive"
              >
                No va
              </span>
            )}
            {respuesta?.estado === "confirmada" && (
              <span title="Ha confirmado que va" className="shrink-0 text-success">
                <CheckCheck className="h-3.5 w-3.5" aria-label="Ha confirmado que va" />
              </span>
            )}
            {violation && (
              <span
                title={`Mínimo ${violation.minLevel}`}
                className="flex shrink-0 items-center gap-0.5 rounded-md bg-warning-muted px-1 py-px text-2xs font-semibold text-warning"
              >
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {abbreviateRefereeLevel(violation.minLevel)}
              </span>
            )}
            {readOnly ? (
              <>
                {slotFlags?.compartido && (
                  <span className="shrink-0 text-2xs font-semibold text-brand" title="Compartido">*</span>
                )}
                {slotFlags?.intercambio && (
                  <span className="shrink-0 text-2xs font-semibold text-info" title="Intercambio">↑↓</span>
                )}
              </>
            ) : (
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(slotKey, "compartido");
                  }}
                  title="Compartido (*) — permite solape tarima/pesaje"
                  aria-label="Compartido"
                  aria-pressed={slotFlags?.compartido ? "true" : "false"}
                  className={cn(
                    "flex h-6 min-w-6 items-center justify-center rounded-md text-2xs font-semibold transition-[color,background-color,scale] duration-(--duration-fast) ease-(--ease-out) active:scale-90 focus-ring",
                    slotFlags?.compartido
                      ? "bg-primary text-primary-foreground"
                      : "text-subtle-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  *
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(slotKey, "intercambio");
                  }}
                  title="Intercambio (↑↓)"
                  aria-label="Intercambio"
                  aria-pressed={slotFlags?.intercambio ? "true" : "false"}
                  className={cn(
                    "flex h-6 min-w-6 items-center justify-center rounded-md text-2xs font-semibold transition-[color,background-color,scale] duration-(--duration-fast) ease-(--ease-out) active:scale-90 focus-ring",
                    slotFlags?.intercambio
                      ? "bg-info text-primary-foreground"
                      : "text-subtle-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  ↑↓
                </button>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-subtle-muted transition-colors hover:bg-surface-hover hover:text-foreground focus-ring"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear(slotKey);
                  }}
                  aria-label="Quitar asignación"
                  title="Quitar asignación"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-7 items-center justify-center gap-1.5 text-center">
            {isDropTarget ? (
              <p className="text-xs font-medium text-brand">Soltar aquí</p>
            ) : isSelected ? (
              <p className="text-xs font-medium text-brand">
                Hueco {cell.slotIndex + 1} · elige un juez a la izquierda
              </p>
            ) : (
              <p className="text-xs text-subtle-muted">
                Hueco {cell.slotIndex + 1}
                {!readOnly && <span className="text-subtle-muted/70"> · clic o arrastra</span>}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SlotGrid({
  sesion,
  roles,
  assignments,
  flags,
  crossZoneMap = {},
  paidRefereeIds,
  respuestas,
  getReferee,
  selectedSlot,
  onSelectSlot,
  onDrop,
  onClear,
  onToggleFlag,
  checkViolation,
  readOnly,
  isDragging,
  variant = "competition",
}: SlotGridProps) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const layout = useMemo(
    () =>
      variant === "pesaje"
        ? buildPesajeSlotLayout(roles)
        : buildCompetitionSlotLayout(roles),
    [roles, variant],
  );

  const sharedCellProps = {
    sesion,
    assignments,
    flags,
    crossZoneMap,
    getReferee,
    selectedSlot,
    onSelectSlot,
    onDrop,
    onClear,
    onToggleFlag,
    checkViolation,
    readOnly,
    isDragging,
    dragOverKey,
    setDragOverKey,
    paidRefereeIds: paidRefereeIds ?? EMPTY_PAID_IDS,
    respuestas: respuestas ?? EMPTY_RESPUESTAS,
  };

  return (
    <div className="flex flex-col gap-2">
      {layout.map((row, rowIndex) => (
        <div key={row.label ?? `row-${rowIndex}`}>
          {row.label ? (
            <p className="mb-1 text-2xs font-semibold text-foreground-secondary">
              {row.label}
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-1.5">
            {row.cells.map((cell, cellIndex) =>
              cell ? (
                <SlotCell key={slotKeyFor(sesion, cell)} cell={cell} {...sharedCellProps} />
              ) : (
                <div
                  key={`empty-${rowIndex}-${cellIndex}`}
                  className="min-h-[52px] rounded border border-transparent"
                  aria-hidden
                />
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
