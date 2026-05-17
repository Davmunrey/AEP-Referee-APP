"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatApiError } from "@/lib/api/error-message";
import { api } from "@/lib/api/client";
import { EventStatusBadge, EventTypeBadge, LevelBadge } from "@/components/aep/badges";
import { RosterHeaderActions } from "@/components/events/roster-header-actions";
import { RosterHelpPanel } from "@/components/events/roster-help-panel";
import { RosterRevisionPanel } from "@/components/events/roster-revision-panel";
import { RosterStepper } from "@/components/events/roster-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  AssignmentsMap,
  Competition,
  FlagsMap,
  Referee,
  RefereeLevel,
  RegulationRule,
  RoleKey,
  RosterRole,
  RosterSession,
  SlotFlags,
  Zone,
} from "@/lib/types";
import { selectFieldClass } from "@/lib/design-tokens";
import { topArbitrajeRoles } from "@/lib/judges-registry/arbitraje-stats";
import {
  countRegulationViolations,
  findRegulationViolation,
  getAssignabilityReason,
  type RosterWorkflowStep,
} from "@/lib/roster-ui";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Info,
  X,
} from "lucide-react";
import { RosterHistoryPanel } from "@/components/events/roster-history-panel";
import { RosterTemplateEditor } from "@/components/events/roster-template-editor";
import { ScheduleImportDialog } from "@/components/events/schedule-import-dialog";
import { FileUp } from "lucide-react";

interface RosterBuilderProps {
  event: Competition;
  template: RosterSession[];
  initialAssignments: AssignmentsMap;
  initialFlags?: FlagsMap;
  canEdit?: boolean;
  /** Campeonato finalizado (`fechaFin < hoy`) — modo lectura forzado. */
  isPast?: boolean;
  referees: Referee[];
  zones: Zone[];
  levels: RefereeLevel[];
  regulations?: RegulationRule[];
  /** Zona por defecto en filtro de jueces (delegado_zona → su zona). */
  defaultZonaFilter?: string;
}

function zoneName(zones: Zone[], code: string) {
  return zones.find((z) => z.code === code)?.name ?? code;
}

export function RosterBuilder({
  event,
  template: initialTemplate,
  initialAssignments,
  initialFlags = {},
  canEdit = false,
  isPast = false,
  referees,
  zones,
  levels,
  regulations = [],
  defaultZonaFilter = "TODAS",
}: RosterBuilderProps) {
  const readOnly = !canEdit;
  const [template, setTemplate] = useState(initialTemplate);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [flags, setFlags] = useState<FlagsMap>(initialFlags);
  const [isEditing, setIsEditing] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [filterZona, setFilterZona] = useState(defaultZonaFilter);
  const [filterNivel, setFilterNivel] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [workflowStep, setWorkflowStep] = useState<RosterWorkflowStep>("asignacion");

  const totalSlots = template.reduce(
    (acc, s) =>
      acc +
      s.roles.reduce((a, r) => a + r.slots, 0) +
      (s.pesajeRoles ?? []).reduce((a, r) => a + r.slots, 0),
    0,
  );
  const filledSlots = Object.values(assignments).filter(Boolean).length;
  const fillPct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
  const openSlots = Math.max(0, totalSlots - filledSlots);
  const plantillaDone = totalSlots > 0;
  const asignacionDone = filledSlots > 0;

  useEffect(() => {
    if (totalSlots === 0) setWorkflowStep("plantilla");
  }, [totalSlots]);

  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter(Boolean)),
    [assignments],
  );

  const getReferee = (id: string) => referees.find((r) => r.id === id);

  const checkViolation = (roleKey: RoleKey, refereeId: string) => {
    const referee = getReferee(refereeId);
    if (!referee) return undefined;
    return findRegulationViolation(roleKey, event.tipo, referee.nivel, regulations);
  };

  const violationCount = useMemo(
    () =>
      countRegulationViolations(
        template,
        assignments,
        event.tipo,
        (id) => referees.find((r) => r.id === id)?.nivel,
        regulations,
      ),
    [assignments, template, regulations, event.tipo, referees],
  );

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
        const aOk = !getAssignabilityReason(a, selectedRoleKey, event.tipo, regulations);
        const bOk = !getAssignabilityReason(b, selectedRoleKey, event.tipo, regulations);
        if (aOk && !bOk) return -1;
        if (!aOk && bOk) return 1;
        return 0;
      });
    }
    return list;
  }, [filterZona, filterNivel, search, referees, selectedRoleKey, regulations, event.tipo]);

  const persistAssign = (slotKey: string, refereeId: string) => {
    const snapshot = assignments;
    const session = slotKey.split("_")[0];
    setAssignments(() => {
      const next = { ...snapshot };
      // Un juez puede estar en varias sesiones; solo se libera su slot
      // anterior DENTRO de la misma sesión (no puede ocupar 2 a la vez).
      for (const k of Object.keys(next)) {
        if (next[k] === refereeId && k.split("_")[0] === session) delete next[k];
      }
      next[slotKey] = refereeId;
      return next;
    });
    startTransition(async () => {
      try {
        const res = await api.assignReferee(event.id, slotKey, refereeId);
        setAssignments(res.assignments);
        if (res.flags) setFlags(res.flags);
        setStatusMsg(null);
        setStatusIsError(false);
      } catch (err) {
        // Revertir la actualización optimista al estado previo.
        setAssignments(snapshot);
        setStatusMsg(formatApiError(err, "No se pudo guardar la asignación"));
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
      } catch (err) {
        setStatusMsg(formatApiError(err, "No se pudo quitar la asignación"));
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

  const toggleFlag = (slotKey: string, field: keyof SlotFlags) => {
    if (readOnly || !assignments[slotKey]) return;
    const current = flags[slotKey] ?? {};
    const next: SlotFlags = { ...current, [field]: !current[field] };
    const snapshot = flags;
    setFlags((prev) => ({ ...prev, [slotKey]: next }));
    startTransition(async () => {
      try {
        const res = await api.setSlotFlags(event.id, slotKey, next);
        setFlags(res.flags);
      } catch (err) {
        setFlags(snapshot);
        setStatusMsg(formatApiError(err, "No se pudieron guardar los marcadores del slot"));
        setStatusIsError(true);
      }
    });
  };

  const saveTemplate = (next: RosterSession[]) => {
    setSavingTemplate(true);
    startTransition(async () => {
      try {
        const res = await api.saveTemplate(event.id, next);
        setTemplate(res.template);
        setAssignments(res.assignments);
        setFlags(res.flags);
        setIsEditing(false);
        setWorkflowStep("asignacion");
        setStatusMsg("Plantilla guardada");
        setStatusIsError(false);
      } catch (err) {
        setStatusMsg(formatApiError(err, "No se pudo guardar la plantilla"));
        setStatusIsError(true);
      } finally {
        setSavingTemplate(false);
      }
    });
  };

  const isDragging = draggedId !== null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <ScheduleImportDialog
        eventId={event.id}
        open={importOpen}
        hasExistingTemplate={template.length > 0}
        onClose={() => setImportOpen(false)}
        onApplied={(tpl) => {
          setTemplate(tpl);
          setImportOpen(false);
          setWorkflowStep("asignacion");
          setStatusMsg("Plantilla importada desde PDF");
          setStatusIsError(false);
        }}
      />
      {/* Page header */}
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
                {isPast && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    title="Campeonato finalizado — solo lectura"
                  >
                    Cerrado
                  </span>
                )}
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
              <p className="flex items-center gap-1.5 rounded-lg border border-warning-border bg-warning-subtle px-3 py-1.5 text-xs font-semibold text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {violationCount} violación{violationCount > 1 ? "es" : ""} de normativa
              </p>
            )}
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setImportOpen(true)}
                  disabled={pending || savingTemplate}
                  title="Importar horario de este campeonato (PDF)"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Importar horario
                </Button>
              )}
              {canEdit && (
                <Button
                  type="button"
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false);
                      setWorkflowStep(totalSlots > 0 ? "asignacion" : "plantilla");
                    } else {
                      setIsEditing(true);
                      setWorkflowStep("plantilla");
                    }
                  }}
                  disabled={pending || savingTemplate}
                >
                  {isEditing ? "Volver a tarima" : "Editar plantilla"}
                </Button>
              )}
              <RosterHistoryPanel eventId={event.id} />
              {!readOnly && !isEditing && (
                <RosterHeaderActions
                  eventId={event.id}
                  filledSlots={filledSlots}
                  totalSlots={totalSlots}
                  fillPct={fillPct}
                  violationCount={violationCount}
                  openSlots={openSlots}
                  pending={pending}
                  statusMsg={statusMsg}
                  statusIsError={statusIsError}
                  onStatus={(msg, isError) => {
                    setStatusMsg(msg);
                    setStatusIsError(isError ?? false);
                  }}
                  startTransition={startTransition}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {!readOnly && (
        <>
          <RosterHelpPanel />
          <RosterStepper
            current={isEditing ? "plantilla" : workflowStep}
            onChange={(step) => {
              setIsEditing(false);
              setWorkflowStep(step);
            }}
            disabled={pending || savingTemplate}
            plantillaDone={plantillaDone}
            asignacionDone={asignacionDone}
          />
        </>
      )}

      {workflowStep === "revision" && !isEditing && !readOnly ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RosterRevisionPanel
            filledSlots={filledSlots}
            totalSlots={totalSlots}
            fillPct={fillPct}
            violationCount={violationCount}
            openSlots={openSlots}
            onGoAssign={() => setWorkflowStep("asignacion")}
          />
        </div>
      ) : workflowStep === "plantilla" && !isEditing && totalSlots === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="max-w-md text-sm text-muted-foreground">
            Este campeonato aún no tiene plantilla de tarima. Importa el horario PDF de este evento
            o define sesiones y plazas manualmente.
          </p>
          {canEdit && (
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                className="gap-1.5"
                onClick={() => setImportOpen(true)}
                disabled={pending}
              >
                <FileUp className="h-3.5 w-3.5" />
                Importar horario (PDF)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditing(true);
                  setWorkflowStep("plantilla");
                }}
                disabled={pending}
              >
                Crear plantilla manual
              </Button>
            </div>
          )}
          <p className="text-[11px] text-subtle-muted">
            El calendario anual (varios campeonatos) se importa desde la lista de Campeonatos.
          </p>
        </div>
      ) : (
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,300px)_1fr] xl:grid-cols-[minmax(0,340px)_1fr]">
        {(workflowStep === "asignacion" || isEditing) && (
        <section className="flex min-h-0 flex-col overflow-hidden border-r border-border">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground-secondary">
              Jueces disponibles
            </h2>
            <p className="mt-0.5 text-xs text-subtle-muted">
              {selectedSlot && !readOnly ? (
                <span className="font-medium text-primary">
                  Slot seleccionado — haz clic en un juez para asignar
                </span>
              ) : (
                "Arrastra o selecciona un slot primero"
              )}
            </p>
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
                aria-label="Filtrar por zona"
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
                aria-label="Filtrar por nivel"
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
              {availableReferees.length} jueces
              {" · "}
              {availableReferees.filter((r) => assignedIds.has(r.id)).length} ya en tarima
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ul className="space-y-1.5 p-3">
              {availableReferees.map((referee) => {
                const blockedReason =
                  selectedRoleKey && selectedSlot
                    ? getAssignabilityReason(
                        referee,
                        selectedRoleKey,
                        event.tipo,
                        regulations,
                      )
                    : null;
                return (
                <RefereeCard
                  key={referee.id}
                  zones={zones}
                  referee={referee}
                  assigned={assignedIds.has(referee.id)}
                  dragging={draggedId === referee.id}
                  blockedReason={blockedReason}
                  onDragStart={() => setDraggedId(referee.id)}
                  onDragEnd={() => setDraggedId(null)}
                  onClick={() => onQuickAssign(referee.id)}
                  highlight={!!selectedSlot && !readOnly}
                  isDragging={isDragging}
                  readOnly={readOnly}
                />
                );
              })}
              {availableReferees.length === 0 && (
                <li className="py-8 text-center text-xs text-subtle-muted">
                  Sin coincidencias. Ajusta los filtros.
                </li>
              )}
            </ul>
          </div>

          <div className="border-t border-border bg-background px-3 py-2">
            <p className="flex items-start gap-2 text-[10.5px] leading-snug text-subtle-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Arrastra un juez a un hueco, o haz clic en el hueco y luego en el juez.
            </p>
          </div>
        </section>
        )}

        {/* ── Right pane: acta ── */}
        <section className="flex flex-col overflow-hidden">
          {isEditing ? (
            <ScrollArea className="flex-1">
              <div className="p-4">
                <RosterTemplateEditor
                  eventId={event.id}
                  eventType={event.tipo}
                  initialTemplate={template}
                  onSave={saveTemplate}
                  onCancel={() => setIsEditing(false)}
                  saving={savingTemplate}
                />
              </div>
            </ScrollArea>
          ) : (
            <>
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground-secondary">
                  Acta de tarima · {template.length} sesión{template.length !== 1 ? "es" : ""}
                </h2>
                <p className="text-xs text-subtle-muted">
                  Competición y pesaje por sesión, agrupadas por día
                </p>
              </div>
              {/* Native scroll div so sticky session day headers work */}
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-5 p-4">
                  {groupSessionsByDay(template).map(([dia, sesiones]) => (
                    <div key={dia} className="space-y-3">
                      {/* Sticky day heading */}
                      <h3 className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-background/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {dia}
                      </h3>
                      {sesiones.map((session) => (
                        <SessionBlock
                          key={session.sesion}
                          session={session}
                          assignments={assignments}
                          flags={flags}
                          getReferee={getReferee}
                          selectedSlot={selectedSlot}
                          onSelectSlot={setSelectedSlot}
                          onDrop={onDrop}
                          onClear={persistClear}
                          onToggleFlag={toggleFlag}
                          checkViolation={checkViolation}
                          readOnly={readOnly}
                          isDragging={isDragging}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      )}
    </div>
  );
}

function RefereeCard({
  zones,
  referee,
  assigned,
  dragging,
  blockedReason,
  onDragStart,
  onDragEnd,
  onClick,
  highlight,
  isDragging,
  readOnly = false,
}: {
  zones: Zone[];
  referee: Referee;
  assigned: boolean;
  dragging: boolean;
  blockedReason?: string | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  highlight: boolean;
  isDragging: boolean;
  readOnly?: boolean;
}) {
  const locked = readOnly || !!blockedReason;
  const topRoles = referee.arbitrajeStats
    ? topArbitrajeRoles(referee.arbitrajeStats, 2)
    : [];
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
        "flex cursor-grab items-center gap-2.5 rounded-lg border border-border bg-surface/80 px-3 py-2 transition-all duration-100 active:cursor-grabbing",
        assigned && "opacity-60",
        locked && "cursor-default",
        dragging && "scale-95 opacity-40 shadow-none",
        !locked && highlight && "cursor-pointer border-primary/50 bg-primary/5 hover:border-primary hover:bg-primary/10 hover:shadow-sm",
        !locked && isDragging && !dragging && "hover:border-success/50 hover:bg-success/5",
        !locked && !highlight && !isDragging && "hover:border-border-strong hover:bg-surface hover:shadow-sm",
      )}
    >
      <GripVertical
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          highlight ? "text-primary" : "text-subtle-muted",
        )}
      />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {referee.iniciales}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{referee.nombre}</p>
        <p className="text-xs text-subtle-muted">{zoneName(zones, referee.zona)}</p>
        <p className="mt-0.5 font-mono text-[10px] text-subtle-muted">
          {referee.eventos} arb.
          {topRoles.length > 0 &&
            ` · ${topRoles.map((r) => `${r.count}× ${r.role}`).join(", ")}`}
        </p>
        {blockedReason && (
          <p className="mt-1 text-[10px] font-medium text-warning">{blockedReason}</p>
        )}
      </div>
      <LevelBadge level={referee.nivel} />
      {assigned && <Check className="h-3.5 w-3.5 shrink-0 text-success" />}
    </li>
  );
}

/** Agrupa sesiones por día preservando el orden. */
function groupSessionsByDay(sessions: RosterSession[]): [string, RosterSession[]][] {
  const groups: [string, RosterSession[]][] = [];
  for (const s of sessions) {
    const dia = s.dia || "Sesiones";
    const existing = groups.find(([d]) => d === dia);
    if (existing) existing[1].push(s);
    else groups.push([dia, [s]]);
  }
  return groups;
}

function sessionProgress(session: RosterSession, assignments: AssignmentsMap) {
  const allRoles = [...session.roles, ...(session.pesajeRoles ?? [])];
  const slots = allRoles.reduce((a, r) => a + r.slots, 0);
  let filled = 0;
  for (const role of allRoles) {
    for (let i = 0; i < role.slots; i++) {
      if (assignments[`${session.sesion}_${role.key}_${i}`]) filled++;
    }
  }
  const pct = slots > 0 ? Math.round((filled / slots) * 100) : 0;
  return { filled, slots, pct };
}

interface SlotGridProps {
  sesion: string;
  roles: RosterRole[];
  assignments: AssignmentsMap;
  flags: FlagsMap;
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

function SlotGrid({
  sesion,
  roles,
  assignments,
  flags,
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
    <div className="space-y-3">
      {roles.map((role) => (
        <div key={role.key}>
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-subtle-muted">
            {role.rol}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: role.slots }).map((_, idx) => {
              const slotKey = `${sesion}_${role.key}_${idx}`;
              const refereeId = assignments[slotKey];
              const referee = refereeId ? getReferee(refereeId) : undefined;
              const isSelected = selectedSlot === slotKey;
              const isDropTarget = dragOverKey === slotKey;
              const violation = refereeId ? checkViolation(role.key, refereeId) : undefined;
              const slotFlags = flags[slotKey];

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
                    "relative min-h-[76px] rounded-lg border-2 p-3 transition-all duration-100",
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
                      {/* Referee name + flags indicator */}
                      <div className="flex items-start justify-between gap-1">
                        <p className="flex-1 truncate text-sm font-semibold text-foreground">
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

                      {/* Level + violation */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <LevelBadge level={referee.nivel} />
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

                      {/* Flag toolbar */}
                      {!readOnly && (
                        <div className="mt-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFlag(slotKey, "compartido");
                            }}
                            title="Compartido (*) — el juez comparte sesión con otro evento"
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
                    <div className="flex h-full min-h-[52px] flex-col items-center justify-center gap-1">
                      {isDropTarget ? (
                        <p className="text-xs font-medium text-primary">Soltar aquí</p>
                      ) : isSelected ? (
                        <p className="text-xs font-medium text-primary">
                          Haz clic en un juez →
                        </p>
                      ) : (
                        <>
                          <p className="text-[11px] text-subtle-muted">Slot vacío</p>
                          {!readOnly && (
                            <p className="text-[10px] text-subtle-muted/70">
                              clic para seleccionar · arrastrar
                            </p>
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

function SessionBlock({
  session,
  assignments,
  flags,
  getReferee,
  selectedSlot,
  onSelectSlot,
  onDrop,
  onClear,
  onToggleFlag,
  checkViolation,
  readOnly = false,
  isDragging,
}: {
  session: RosterSession;
  assignments: AssignmentsMap;
  flags: FlagsMap;
  getReferee: (id: string) => Referee | undefined;
  selectedSlot: string | null;
  onSelectSlot: (key: string | null) => void;
  onDrop: (slotKey: string, refereeId: string) => void;
  onClear: (slotKey: string) => void;
  onToggleFlag: (slotKey: string, field: keyof SlotFlags) => void;
  checkViolation: (roleKey: RoleKey, refereeId: string) => RegulationRule | undefined;
  readOnly?: boolean;
  isDragging: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { filled, slots, pct } = sessionProgress(session, assignments);
  const barColor = pct >= 100 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-primary";
  const pesajeRoles = session.pesajeRoles ?? [];

  const grid = {
    sesion: session.sesion,
    assignments,
    flags,
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
      <header className="flex items-start gap-3 p-4">
        {/* Collapse toggle */}
        <button
          type="button"
          className="mt-0.5 rounded text-subtle-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-primary">{session.sesion}</p>
          <h3 className="font-semibold text-foreground">{session.nombre}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {(session.categorias ?? []).map((c, i) => (
              <span
                key={i}
                className="rounded bg-surface-active px-1.5 py-0.5 text-[10.5px] text-foreground-secondary"
              >
                {c.genero} {c.pesos}
              </span>
            ))}
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-subtle-muted">
            <span>Competición {session.horarioCompeticion}</span>
            <span>Pesaje {session.horarioPesaje}</span>
          </p>
          {session.grupos && session.grupos.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-foreground-secondary">
              {session.grupos.map((g, gi) => (
                <li key={gi} className="flex flex-wrap gap-1">
                  <span className="font-mono text-subtle-muted">{g.nombre}:</span>
                  <span>
                    {g.categorias.map((c) => `${c.genero} ${c.pesos}`).join(" · ") || "—"}
                  </span>
                  {typeof g.levantadores === "number" && (
                    <span className="text-subtle-muted">({g.levantadores} lev.)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Progress mini-bar */}
        <div className="min-w-[90px] shrink-0">
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
        <div className="border-t border-border-muted px-4 pb-4 pt-3">
          {/* Competition roles group heading */}
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-foreground-secondary">
            Competición
          </p>
          <SlotGrid roles={session.roles} {...grid} />

          {pesajeRoles.length > 0 && (
            <>
              {/* Pesaje separator */}
              <div className="my-4 flex items-center gap-2">
                <div className="flex-1 border-t border-border-muted" />
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-primary">
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
