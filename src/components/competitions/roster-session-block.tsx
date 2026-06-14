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
} from "@/lib/types";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { sessionProgress, summarizeSessionCategories, summarizeSessionGroups } from "./roster-session-helpers";
import { SlotGrid, type SlotGridProps } from "./roster-slot-grid";

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
        active ? "border-primary bg-primary/8 shadow-sm" : "border-border bg-background/75 hover:border-border-strong hover:bg-surface",
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
          className={cn("h-full rounded-full transition-all duration-300", pct >= 100 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}

/**
 * Pestaña compacta de sesión para el selector fijo del builder. A diferencia de
 * SessionOverviewCard (tarjeta alta que crece en vertical), esta ocupa ~1 fila y
 * vive en una tira con scroll horizontal: montar 12 sesiones cuesta lo mismo en
 * alto que montar 2, y cambiar de sesión no obliga a hacer scroll.
 */
export function SessionTab({
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
  const done = slots > 0 && filled >= slots;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${session.sesion} · ${session.nombre}`}
      className={cn(
        "flex w-[160px] shrink-0 flex-col gap-1 rounded-lg border px-2.5 py-1.5 text-left transition-colors focus-ring",
        active
          ? "border-primary bg-primary/8 shadow-sm"
          : "border-border bg-background/75 hover:border-border-strong hover:bg-surface",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="font-mono text-[11px] font-semibold text-primary">{session.sesion}</span>
          <span className="truncate text-[12px] font-medium text-foreground">{session.nombre}</span>
        </span>
        <span
          className={cn(
            "shrink-0 font-mono text-[10px] tabular-nums",
            done ? "text-success" : "text-subtle-muted",
          )}
        >
          {filled}/{slots}
        </span>
      </span>
      <span className="block h-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-300",
            pct >= 100 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
    </button>
  );
}

export function SessionBlock({
  session,
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
  readOnly = false,
  isDragging,
  defaultExpanded = false,
}: {
  session: RosterSession;
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
  readOnly?: boolean;
  isDragging: boolean;
  defaultExpanded?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
  const { filled, slots, pct } = sessionProgress(session, assignments);
  const barColor = pct >= 100 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-primary";
  const pesajeRoles = session.pesajeRoles ?? [];
  const groupsSummary = summarizeSessionGroups(session);

  const grid: Omit<SlotGridProps, "roles"> = {
    sesion: session.sesion,
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
  };

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface/40 shadow-sm">
      <header className="grid gap-2 border-b border-border-muted p-2.5 lg:grid-cols-[auto_minmax(0,1.15fr)_minmax(0,2fr)_auto] lg:items-center">
        <button
          type="button"
          className="rounded text-subtle-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={collapsed ? "Expandir sesión" : "Colapsar sesión"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>

        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="font-mono text-xs font-semibold text-primary">{session.sesion}</span>
            <h3 className="truncate text-sm font-semibold text-foreground">{session.nombre}</h3>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-subtle-muted">
            <span>Comp. {session.horarioCompeticion}</span>
            <span>Pesaje {session.horarioPesaje}</span>
          </p>
        </div>

        <div className="min-w-0">
          <p className="truncate text-[11px] text-foreground-secondary">
            {summarizeSessionCategories(session)}
          </p>
          {groupsSummary ? (
            <p className="mt-1 truncate text-[10.5px] text-subtle-muted" title={groupsSummary}>
              {groupsSummary}
            </p>
          ) : null}
        </div>

        <div className="min-w-[86px] shrink-0">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-500", barColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-right font-mono text-[11px] tabular-nums text-subtle-muted">
            {filled}/{slots}
          </p>
        </div>
      </header>

      {!collapsed && (
        <div className="px-2.5 pb-2.5 pt-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground-secondary">
            Competición
          </p>
          <SlotGrid roles={session.roles} {...grid} />

          {pesajeRoles.length > 0 && (
            <>
              <div className="my-2.5 flex items-center gap-2">
                <div className="flex-1 border-t border-border-muted" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Pesaje · {session.horarioPesaje}
                </p>
                <div className="flex-1 border-t border-border-muted" />
              </div>
              <SlotGrid roles={pesajeRoles} {...grid} />
            </>
          )}
        </div>
      )}
    </article>
  );
}
