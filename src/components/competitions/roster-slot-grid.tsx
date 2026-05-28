"use client";

import { useState } from "react";
import type {
  AssignmentsMap,
  FlagsMap,
  CrossZoneMap,
  Referee,
  SlotFlags,
  RoleKey,
  RegulationRule,
  RosterSession,
  RosterRole,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";
import { LevelBadge } from "@/components/aep/badges";
import { cn } from "@/lib/utils";
import { sessionProgress, summarizeSessionCategories, slotRoleEntries } from "./roster-session-helpers";

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
}: SlotGridProps) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  return (
    <div className="grid gap-2 2xl:grid-cols-2">
      {roles.map((role) => (
        <div
          key={role.key}
          className="rounded-lg border border-border-muted bg-background/55 p-2"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle-muted">
              {role.rol}
            </p>
            <span className="font-mono text-[10px] text-subtle-muted">
              {Array.from({ length: role.slots }).filter((_, idx) => {
                const slotKey = `${sesion}_${role.key}_${idx}`;
                return assignments[slotKey];
              }).length}
              /{role.slots}
            </span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2 min-[1800px]:grid-cols-3">
            {Array.from({ length: role.slots }).map((_, idx) => {
              const slotKey = `${sesion}_${role.key}_${idx}`;
              const refereeId = assignments[slotKey];
              const referee = refereeId ? getReferee(refereeId) : undefined;
              const isSelected = selectedSlot === slotKey;
              const isDropTarget = dragOverKey === slotKey;
              const violation = refereeId ? checkViolation(role.key, refereeId) : undefined;
              const slotFlags = flags[slotKey];
              const isCrossZone = !!crossZoneMap[slotKey];

              return (
                <div
                  key={slotKey}
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
                  className={cn(
                    "relative rounded-md border p-2 transition-all duration-100",
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
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-semibold text-foreground">
                            {referee.nombre}
                            {slotFlags?.compartido && (
                              <span
                                className="ml-1 font-mono text-primary"
                                title="Compartido entre sesiones"
                              >
                                *
                              </span>
                            )}
                            {slotFlags?.intercambio && (
                              <span
                                className="ml-0.5 font-mono text-accent"
                                title="Intercambio de jueces"
                              >
                                ↑↓
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[10px] text-subtle-muted">
                            Hueco {idx + 1}
                          </p>
                        </div>
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-subtle-muted hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClear(slotKey);
                            }}
                            aria-label="Quitar asignación"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <LevelBadge level={referee.nivel} />
                        {isCrossZone && (
                          <span
                            title={`Juez de fuera de zona (${referee.zona})`}
                            className="flex items-center gap-0.5 rounded border border-orange-400/60 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                          >
                            ⟳ {referee.zona}
                          </span>
                        )}
                        {violation && (
                          <span
                            title={`Mínimo ${violation.minLevel} para ${violation.rol}`}
                            className="flex items-center gap-1 rounded border border-warning-border bg-warning-muted px-1.5 py-0.5 text-[10px] font-semibold text-warning"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            min. {violation.minLevel}
                          </span>
                        )}
                      </div>

                      {!readOnly && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFlag(slotKey, "compartido");
                            }}
                            title="Compartido (*) — el juez comparte sesión con otra competición"
                            aria-pressed={slotFlags?.compartido ? "true" : "false"}
                            className={cn(
                              "flex h-6 items-center gap-1 rounded border px-1.5 font-mono text-[10px] transition-colors",
                              slotFlags?.compartido
                                ? "border-primary bg-primary text-white"
                                : "border-border bg-background text-subtle-muted hover:border-primary/50 hover:text-primary",
                            )}
                          >
                            <span>*</span>
                            <span className="hidden text-[9px] sm:inline">Comp.</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFlag(slotKey, "intercambio");
                            }}
                            title="Intercambio (↑↓) — juez en intercambio con otra federación"
                            aria-pressed={slotFlags?.intercambio ? "true" : "false"}
                            className={cn(
                              "flex h-6 items-center gap-1 rounded border px-1.5 font-mono text-[10px] transition-colors",
                              slotFlags?.intercambio
                                ? "border-accent bg-accent text-white"
                                : "border-border bg-background text-subtle-muted hover:border-accent/50 hover:text-accent",
                            )}
                          >
                            <span>↑↓</span>
                            <span className="hidden text-[9px] sm:inline">Interc.</span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-[42px] flex-col items-center justify-center gap-0.5 text-center">
                      {isDropTarget ? (
                        <p className="text-xs font-medium text-primary">Soltar aquí</p>
                      ) : isSelected ? (
                        <>
                          <p className="text-xs font-medium text-primary">Hueco {idx + 1}</p>
                          <p className="text-[10px] text-primary/80">Elige un juez a la izquierda</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[11px] text-subtle-muted">Hueco {idx + 1}</p>
                          {!readOnly && (
                            <p className="text-[10px] text-subtle-muted/70">clic o arrastra</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SessionOverviewCard({
  session,
  assignments,
  active,
  onClick,
}: {
  session: RosterSession;
  assignments: AssignmentsMap;
  active: boolean;
  onClick: () => void;
}) {
  const { filled, slots, pct } = sessionProgress(session, assignments);
  const groupsCount = session.grupos?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border px-2.5 py-2 text-left transition-all focus-ring",
        active
          ? "border-primary bg-primary/8 shadow-sm"
          : "border-border bg-background/75 hover:border-border-strong hover:bg-surface",
      )}
      aria-pressed={active}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-primary">{session.sesion}</span>
            <span className="text-[13px] font-semibold text-foreground">{session.nombre}</span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[10.5px] leading-snug text-muted-foreground">
            {summarizeSessionCategories(session)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-hover px-2 py-1 font-mono text-[11px] text-foreground-secondary">
          {filled}/{slots}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-[10.5px] text-subtle-muted">
        <span>Comp. {session.horarioCompeticion}</span>
        <span>Pesaje {session.horarioPesaje}</span>
        {groupsCount > 0 && <span>{groupsCount} grupo{groupsCount > 1 ? "s" : ""}</span>}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            pct >= 100 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}
