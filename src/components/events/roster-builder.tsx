"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { EventStatusBadge, EventTypeBadge, LevelBadge } from "@/components/aep/badges";
import { RosterHeaderActions } from "@/components/events/roster-header-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  AssignmentsMap,
  Competition,
  Referee,
  RefereeLevel,
  RegulationRule,
  RoleKey,
  RosterSession,
  UserRole,
  Zone,
} from "@/lib/types";
import { selectFieldClass } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowLeft, Check, GripVertical, Info, X } from "lucide-react";
import { RosterHistoryPanel } from "@/components/events/roster-history-panel";

const LEVEL_ORDER: RefereeLevel[] = ["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"];

function meetsMinLevel(actual: RefereeLevel, min: RefereeLevel): boolean {
  return LEVEL_ORDER.indexOf(actual) >= LEVEL_ORDER.indexOf(min);
}

function violatesRegulation(
  roleKey: RoleKey,
  eventType: string,
  nivel: RefereeLevel,
  regulations: RegulationRule[],
): RegulationRule | undefined {
  return regulations.find(
    (r) =>
      r.roleKey === roleKey &&
      r.eventTypes.includes(eventType as Competition["tipo"]) &&
      !meetsMinLevel(nivel, r.minLevel),
  );
}

interface RosterBuilderProps {
  event: Competition;
  template: RosterSession[];
  initialAssignments: AssignmentsMap;
  referees: Referee[];
  zones: Zone[];
  levels: RefereeLevel[];
  regulations?: RegulationRule[];
  userRole?: UserRole;
}

function zoneName(zones: Zone[], code: string) {
  return zones.find((z) => z.code === code)?.name ?? code;
}

export function RosterBuilder({
  event,
  template,
  initialAssignments,
  referees,
  zones,
  levels,
  regulations = [],
  userRole,
}: RosterBuilderProps) {
  const readOnly = userRole === "solo_ver" || userRole === "delegado_jueces";
  const [assignments, setAssignments] = useState(initialAssignments);
  const [filterZona, setFilterZona] = useState("TODAS");
  const [filterNivel, setFilterNivel] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [pending, startTransition] = useTransition();

  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter(Boolean)),
    [assignments],
  );

  const getReferee = (id: string) => referees.find((r) => r.id === id);

  const checkViolation = (roleKey: RoleKey, refereeId: string) => {
    const referee = getReferee(refereeId);
    if (!referee) return undefined;
    return violatesRegulation(roleKey, event.tipo, referee.nivel, regulations);
  };

  const violationCount = useMemo(() => {
    let count = 0;
    for (const session of template) {
      for (const role of session.roles) {
        for (let i = 0; i < role.slots; i++) {
          const key = `${session.sesion}_${role.key}_${i}`;
          const refId = assignments[key];
          if (refId && violatesRegulation(role.key, event.tipo, getReferee(refId)?.nivel ?? "Regional", regulations)) {
            count++;
          }
        }
      }
    }
    return count;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, template, regulations, event.tipo]);

  const totalSlots = template.reduce(
    (acc, s) => acc + s.roles.reduce((a, r) => a + r.slots, 0),
    0,
  );
  const filledSlots = Object.values(assignments).filter(Boolean).length;
  const fillPct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  const selectedRoleKey = selectedSlot
    ? (selectedSlot.split("_")[1] as RoleKey | undefined)
    : undefined;

  const availableReferees = useMemo(() => {
    const list = referees.filter((r) => {
      if (r.estado !== "Activo" || !r.disp) return false;
      if (filterZona !== "TODAS" && r.zona !== filterZona) return false;
      if (filterNivel !== "TODOS" && r.nivel !== filterNivel) return false;
      if (search && !r.nombre.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (selectedRoleKey) {
      list.sort((a, b) => {
        const aOk = !violatesRegulation(selectedRoleKey, event.tipo, a.nivel, regulations);
        const bOk = !violatesRegulation(selectedRoleKey, event.tipo, b.nivel, regulations);
        if (aOk && !bOk) return -1;
        if (!aOk && bOk) return 1;
        return 0;
      });
    }
    return list;
  }, [filterZona, filterNivel, search, referees, selectedRoleKey, regulations, event.tipo]);

  const persistAssign = (slotKey: string, refereeId: string) => {
    const snapshot = assignments;
    setAssignments(() => {
      const next = { ...snapshot };
      for (const k of Object.keys(next)) {
        if (next[k] === refereeId) delete next[k];
      }
      next[slotKey] = refereeId;
      return next;
    });
    startTransition(async () => {
      try {
        const res = await api.assignReferee(event.id, slotKey, refereeId);
        setAssignments(res.assignments);
        setStatusMsg(null);
        setStatusIsError(false);
      } catch (err) {
        // Revertir la actualización optimista al estado previo.
        setAssignments(snapshot);
        setStatusMsg(err instanceof Error ? err.message : "No se pudo guardar la asignación");
        setStatusIsError(true);
      }
    });
  };

  const persistClear = (slotKey: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    startTransition(async () => {
      try {
        const res = await api.clearSlot(event.id, slotKey);
        setAssignments(res.assignments);
      } catch {
        setStatusMsg("No se pudo quitar la asignación");
        setStatusIsError(true);
      }
    });
  };

  const onDrop = (slotKey: string, refereeId: string) => {
    if (readOnly) return;
    persistAssign(slotKey, refereeId);
    setDraggedId(null);
    setSelectedSlot(null);
  };

  const onQuickAssign = (refereeId: string) => {
    if (!selectedSlot || readOnly) return;
    persistAssign(selectedSlot, refereeId);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="glass-panel-soft border-b border-border-muted px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/events" aria-label="Volver a campeonatos">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <EventTypeBadge tipo={event.tipo} />
                <EventStatusBadge status={event.estado} />
                <span className="text-xs text-subtle-muted">{event.aprobacion}</span>
              </div>
              <h1 className="text-xl font-semibold text-foreground">{event.nombre}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.fecha} → {event.fechaFin} · {event.sede}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {violationCount > 0 && (
              <p className="flex items-center gap-1.5 rounded-lg border border-warning-border bg-warning-subtle px-3 py-1.5 text-xs font-medium text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {violationCount} violación{violationCount > 1 ? "es" : ""} normativa
              </p>
            )}
            <div className="flex items-center gap-2">
              <RosterHistoryPanel eventId={event.id} />
              {!readOnly && (
                <RosterHeaderActions
                  eventId={event.id}
                  filledSlots={filledSlots}
                  totalSlots={totalSlots}
                  fillPct={fillPct}
                  pending={pending}
                  statusMsg={statusMsg}
                  statusIsError={statusIsError}
                  onStatus={(msg, isError) => { setStatusMsg(msg); setStatusIsError(isError ?? false); }}
                  startTransition={startTransition}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <section className="flex flex-col border-r border-border">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground-secondary">Árbitros disponibles</h2>
            <p className="text-xs text-subtle-muted">Arrastra o selecciona un slot y haz clic</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <select
                value={filterZona}
                onChange={(e) => setFilterZona(e.target.value)}
                className={selectFieldClass}
              >
                <option value="TODAS">Todas las zonas</option>
                {zones.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}
                  </option>
                ))}
              </select>
              <select
                value={filterNivel}
                onChange={(e) => setFilterNivel(e.target.value)}
                className={selectFieldClass}
              >
                <option value="TODOS">Todos los niveles</option>
                {levels.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 font-mono text-[10px] text-subtle-muted">
              {availableReferees.filter((r) => !assignedIds.has(r.id)).length} disponibles
              {" · "}
              {availableReferees.length} en total
            </p>
          </div>
          <ScrollArea className="flex-1">
            <ul className="space-y-2 p-4">
              {availableReferees.map((referee) => (
                <RefereeCard
                  key={referee.id}
                  zones={zones}
                  referee={referee}
                  assigned={assignedIds.has(referee.id)}
                  dragging={draggedId === referee.id}
                  onDragStart={() => setDraggedId(referee.id)}
                  onDragEnd={() => setDraggedId(null)}
                  onClick={() => onQuickAssign(referee.id)}
                  highlight={!!selectedSlot && !readOnly}
                  readOnly={readOnly}
                />
              ))}
              {availableReferees.length === 0 && (
                <li className="py-8 text-center text-xs text-subtle-muted">
                  Sin coincidencias. Ajusta los filtros.
                </li>
              )}
            </ul>
          </ScrollArea>
          <div className="border-t border-border bg-background px-3 py-2">
            <p className="flex items-start gap-2 text-[10.5px] leading-snug text-subtle-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Arrastra un árbitro a un hueco, o haz clic en un hueco y luego en el árbitro.
            </p>
          </div>
        </section>

        <section className="flex flex-col overflow-hidden">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground-secondary">Slots de asignación</h2>
            <p className="text-xs text-subtle-muted">
              Juez Central, Laterales, Pesaje y Jurado por sesión
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4">
              {template.map((session) => (
                <SessionBlock
                  key={session.sesion}
                  session={session}
                  assignments={assignments}
                  getReferee={getReferee}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                  onDrop={onDrop}
                  onClear={persistClear}
                  checkViolation={checkViolation}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </ScrollArea>
        </section>
      </div>
    </div>
  );
}

function RefereeCard({
  zones,
  referee,
  assigned,
  dragging,
  onDragStart,
  onDragEnd,
  onClick,
  highlight,
  readOnly = false,
}: {
  zones: Zone[];
  referee: Referee;
  assigned: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  highlight: boolean;
  readOnly?: boolean;
}) {
  const locked = assigned || readOnly;
  return (
    <li
      draggable={!locked}
      onDragStart={(e) => {
        if (locked) return;
        e.dataTransfer.setData("text/plain", referee.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => !locked && onClick()}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-surface/80 px-3 py-2.5 transition-colors",
        assigned && "cursor-not-allowed opacity-40",
        readOnly && !assigned && "cursor-default",
        !locked && "cursor-grab active:cursor-grabbing",
        !locked && highlight && "hover:border-warning-border hover:bg-warning-subtle",
        dragging && "opacity-50",
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-subtle-muted" />
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {referee.iniciales}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{referee.nombre}</p>
        <p className="text-xs text-subtle-muted">{zoneName(zones, referee.zona)}</p>
      </div>
      <LevelBadge level={referee.nivel} />
      {assigned && <Check className="h-3.5 w-3.5 text-success" />}
    </li>
  );
}

function sessionProgress(session: RosterSession, assignments: AssignmentsMap) {
  const slots = session.roles.reduce((a, r) => a + r.slots, 0);
  let filled = 0;
  for (const role of session.roles) {
    for (let i = 0; i < role.slots; i++) {
      if (assignments[`${session.sesion}_${role.key}_${i}`]) filled++;
    }
  }
  const pct = slots > 0 ? Math.round((filled / slots) * 100) : 0;
  return { filled, slots, pct };
}

function SessionBlock({
  session,
  assignments,
  getReferee,
  selectedSlot,
  onSelectSlot,
  onDrop,
  onClear,
  checkViolation,
  readOnly = false,
}: {
  session: RosterSession;
  assignments: AssignmentsMap;
  getReferee: (id: string) => Referee | undefined;
  selectedSlot: string | null;
  onSelectSlot: (key: string | null) => void;
  onDrop: (slotKey: string, refereeId: string) => void;
  onClear: (slotKey: string) => void;
  checkViolation: (roleKey: RoleKey, refereeId: string) => RegulationRule | undefined;
  readOnly?: boolean;
}) {
  const { filled, slots, pct } = sessionProgress(session, assignments);
  const barColor = pct >= 100 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-primary";

  return (
    <article className="rounded-xl border border-border bg-surface/40 p-4">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-primary">{session.sesion}</p>
          <h3 className="font-medium text-foreground">{session.nombre}</h3>
          <p className="text-xs text-subtle-muted">{session.fecha}</p>
          <p className="mt-1 text-xs text-subtle-muted">{session.grupos.join(" · ")}</p>
        </div>
        <div className="min-w-[100px]">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-right font-mono text-[11px] tabular-nums text-subtle-muted">
            {filled}/{slots}
          </p>
        </div>
      </header>
      <div className="space-y-4">
        {session.roles.map((role) => (
          <div key={role.key}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle-muted">
              {role.rol}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: role.slots }).map((_, idx) => {
                const slotKey = `${session.sesion}_${role.key}_${idx}`;
                const refereeId = assignments[slotKey];
                const referee = refereeId ? getReferee(refereeId) : undefined;
                const isSelected = selectedSlot === slotKey;
                const violation = refereeId ? checkViolation(role.key, refereeId) : undefined;

                return (
                  <div
                    key={slotKey}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) onDrop(slotKey, id);
                    }}
                    onClick={() => {
                      if (readOnly) return;
                      onSelectSlot(isSelected ? null : slotKey);
                    }}
                    className={cn(
                      "relative min-h-[72px] rounded-lg border border-dashed p-3 transition-colors",
                      isSelected
                        ? "border-primary-border bg-primary-muted"
                        : violation
                          ? "border-warning-border bg-warning-subtle"
                          : referee
                            ? "border-border-strong bg-muted/50"
                            : "border-border-strong bg-background/50 hover:border-border-strong",
                    )}
                  >
                    {referee ? (
                      <>
                        <p className="text-sm font-medium text-foreground">{referee.nombre}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <LevelBadge level={referee.nivel} />
                          {violation && (
                            <span
                              title={`Mínimo ${violation.minLevel} para ${violation.rol}`}
                              className="flex items-center gap-1 text-[10px] text-warning"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              min. {violation.minLevel}
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-7 w-7 text-subtle-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClear(slotKey);
                          }}
                          aria-label="Quitar asignación"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-subtle-muted">
                        {isSelected ? "Selecciona un árbitro" : "Slot vacío — clic o arrastrar"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
