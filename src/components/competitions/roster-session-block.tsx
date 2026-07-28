"use client";

import { memo, useState } from "react";
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
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { disclosureEnter } from "@/components/aep/motion";
import { summarizeRequiredSlots } from "@/lib/roster-template";
import { sessionProgress, summarizeSessionCategories, summarizeSessionGroups } from "./roster-session-helpers";
import { SlotGrid, type SlotGridProps } from "./roster-slot-grid";

/** Chips compactos con las plazas requeridas por área (tarima, mesa, control, pesaje). */
export function RequiredSlotsChips({
  source,
  className,
}: {
  source: RosterSession | RosterSession[];
  className?: string;
}) {
  const groups = summarizeRequiredSlots(source);
  if (groups.length === 0) return null;
  const total = groups.reduce((acc, group) => acc + group.count, 0);
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle-muted">
        Plazas {total}
      </span>
      {groups.map((group) => (
        <span
          key={group.key}
          className="inline-flex items-center gap-1 rounded-full border border-border-muted bg-background/60 px-1.5 py-0.5 text-[10px] text-foreground-secondary"
        >
          {group.label}
          <span className="font-mono font-semibold text-foreground">{group.count}</span>
        </span>
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
        "w-full rounded-lg border px-2.5 py-2 text-left transition-[color,background-color,border-color,box-shadow,scale] duration-150 ease-(--ease-out) active:scale-[0.995] focus-ring",
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
          className={cn(
            // Una sola ley para todas las barras de cobertura de la tarima:
            // 300 ms, misma curva, y solo el ancho (lo demás no cambia).
            "h-full rounded-full transition-[width] duration-300 ease-(--ease-out)",
            pct >= 100 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-primary",
          )}
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
export const SessionTab = memo(function SessionTab({
  session,
  assignments,
  active,
  onClick,
}: {
  session: RosterSession;
  assignments: AssignmentsMap;
  active: boolean;
  onClick: (sesion: string) => void;
}) {
  const { filled, slots, pct } = sessionProgress(session, assignments);
  const done = slots > 0 && filled >= slots;
  return (
    <button
      type="button"
      onClick={() => onClick(session.sesion)}
      aria-pressed={active}
      title={`${session.sesion} · ${session.nombre}`}
      className={cn(
        "flex w-[160px] shrink-0 flex-col gap-1 rounded-lg border px-2.5 py-1.5 text-left transition-[color,background-color,border-color,box-shadow,scale] duration-150 ease-(--ease-out) active:scale-[0.985] focus-ring",
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
            "block h-full rounded-full transition-[width] duration-300 ease-(--ease-out)",
            pct >= 100 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
    </button>
  );
});

// Memoizado: evita repintar toda la parrilla de la sesión cuando el builder
// re-renderiza por cambios que no la afectan (búsqueda, filtros, arrastre).
export const SessionBlock = memo(function SessionBlock({
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
      <header className="grid gap-1.5 border-b border-border-muted p-2 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.5fr)_auto] lg:items-center">
        <button
          type="button"
          className="rounded text-subtle-muted transition-colors duration-100 hover:text-foreground focus-ring"
          aria-label={collapsed ? "Expandir sesión" : "Colapsar sesión"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          {/* Un solo icono que gira en vez de dos que se intercambian: el giro
              explica el cambio de estado; el intercambio solo lo sustituye. */}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200 ease-(--ease-out)",
              !collapsed && "rotate-180",
            )}
          />
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
          <RequiredSlotsChips source={session} className="mt-1.5" />
        </div>

        <div className="min-w-[86px] shrink-0">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300 ease-(--ease-out)",
                barColor,
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-right font-mono text-[11px] tabular-nums text-subtle-muted">
            {filled}/{slots}
          </p>
        </div>
      </header>

      {!collapsed && (
        <div className={cn("px-2.5 pb-2.5 pt-2", disclosureEnter)}>
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
              <SlotGrid roles={pesajeRoles} variant="pesaje" {...grid} />
            </>
          )}
        </div>
      )}
    </article>
  );
});
