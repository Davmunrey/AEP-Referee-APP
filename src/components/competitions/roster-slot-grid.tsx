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
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";
import { LevelBadge } from "@/components/aep/badges";
import { abbreviateRefereeLevel } from "@/lib/referee-level-label";
import { cn } from "@/lib/utils";
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

function slotKeyFor(sesion: string, cell: SlotCellRef): string {
  return `${sesion}_${cell.role.key}_${cell.slotIndex}`;
}

function SlotCell({
  sesion,
  cell,
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
}: {
  sesion: string;
  cell: SlotCellRef;
  assignments: AssignmentsMap;
  flags: FlagsMap;
  crossZoneMap: CrossZoneMap;
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
  const slotLabel =
    cell.role.slots > 1 ? `${cell.role.rol} ${cell.slotIndex + 1}` : cell.role.rol;

  return (
    <div className="min-w-0">
      <p className="mb-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle-muted">
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
          "relative min-h-[52px] rounded border p-1.5 transition-all duration-100 focus-ring",
          !readOnly && "cursor-pointer",
          isDropTarget
            ? "border-primary bg-primary/10 shadow-md"
            : isSelected
              ? "border-primary bg-primary/5 shadow-sm"
              : violation
                ? "border-warning-border bg-warning-subtle"
                : referee
                  ? "border-border-strong bg-muted/40"
                  : isDragging
                    ? "border-dashed border-success/50 bg-success/5 hover:border-success hover:bg-success/10"
                    : "border-dashed border-border-strong bg-background/50 hover:border-primary/50 hover:bg-primary/5",
        )}
      >
        {referee ? (
          <>
            <div className="flex items-start justify-between gap-0.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-semibold leading-tight text-foreground">
                  {referee.nombre}
                  {slotFlags?.compartido && (
                    <span className="ml-0.5 font-mono text-[10px] text-primary" title="Compartido">
                      *
                    </span>
                  )}
                  {slotFlags?.intercambio && (
                    <span className="ml-0.5 font-mono text-[10px] text-info" title="Intercambio">
                      ↑↓
                    </span>
                  )}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  <LevelBadge level={referee.nivel} compact />
                  {isCrossZone && (
                    <span
                      title={`Fuera de zona (${referee.zona})`}
                      className="rounded border border-warning-border bg-warning-muted px-1 py-px text-[9px] font-semibold text-warning"
                    >
                      ⟳
                    </span>
                  )}
                  {violation && (
                    <span
                      title={`Mínimo ${violation.minLevel}`}
                      className="flex items-center gap-0.5 rounded border border-warning-border bg-warning-muted px-1 py-px text-[9px] font-semibold text-warning"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {abbreviateRefereeLevel(violation.minLevel)}
                    </span>
                  )}
                </div>
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 text-subtle-muted hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear(slotKey);
                  }}
                  aria-label="Quitar asignación"
                >
                  <X className="h-2.5 w-2.5" />
                </Button>
              )}
            </div>

            {!readOnly && (
              <div className="mt-1 flex gap-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(slotKey, "compartido");
                  }}
                  title="Compartido (*) — permite solape tarima/pesaje"
                  aria-pressed={slotFlags?.compartido ? "true" : "false"}
                  className={cn(
                    "flex h-5 min-w-[1.25rem] items-center justify-center rounded border font-mono text-[9px] transition-colors",
                    slotFlags?.compartido
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-subtle-muted hover:border-primary/50",
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
                  aria-pressed={slotFlags?.intercambio ? "true" : "false"}
                  className={cn(
                    "flex h-5 min-w-[1.25rem] items-center justify-center rounded border font-mono text-[9px] transition-colors",
                    slotFlags?.intercambio
                      ? "border-info bg-info text-primary-foreground"
                      : "border-border bg-background text-subtle-muted hover:border-info/50",
                  )}
                >
                  ↑↓
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex min-h-[36px] flex-col items-center justify-center gap-0.5 text-center">
            {isDropTarget ? (
              <p className="text-xs font-medium text-primary">Soltar aquí</p>
            ) : isSelected ? (
              <>
                <p className="text-xs font-medium text-primary">Hueco {cell.slotIndex + 1}</p>
                <p className="text-[10px] text-primary/80">Elige un juez a la izquierda</p>
              </>
            ) : (
              <>
                <p className="text-[11px] text-subtle-muted">Hueco {cell.slotIndex + 1}</p>
                {!readOnly && <p className="text-[10px] text-subtle-muted/70">clic o arrastra</p>}
              </>
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
  };

  return (
    <div className="flex flex-col gap-2">
      {layout.map((row, rowIndex) => (
        <div key={row.label ?? `row-${rowIndex}`}>
          {row.label ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-secondary">
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
