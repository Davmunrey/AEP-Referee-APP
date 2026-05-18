"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatApiError } from "@/lib/api/error-message";
import { api } from "@/lib/api/client";
import { zoneUiName } from "@/lib/aep-zones";
import { EventStatusBadge, EventTypeBadge, LevelBadge } from "@/components/aep/badges";
import { RosterHeaderActions } from "@/components/competitions/roster-header-actions";
import { RosterHelpPanel } from "@/components/competitions/roster-help-panel";
import { RosterRevisionPanel } from "@/components/competitions/roster-revision-panel";
import { RosterStepper } from "@/components/competitions/roster-stepper";
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
  ChevronRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Info,
  X,
} from "lucide-react";
import { RosterHistoryPanel } from "@/components/competitions/roster-history-panel";
import { RosterTemplateEditor } from "@/components/competitions/roster-template-editor";
import { ScheduleImportDialog } from "@/components/competitions/schedule-import-dialog";
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
  return zoneUiName(zones.find((z) => z.code === code)?.code ?? code);
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
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(
    initialTemplate[0]?.sesion ?? null,
  );
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

  useEffect(() => {
    if (template.length === 0) {
      setActiveSessionKey(null);
      return;
    }
    if (!activeSessionKey || !template.some((session) => session.sesion === activeSessionKey)) {
      setActiveSessionKey(template[0]?.sesion ?? null);
    }
  }, [template, activeSessionKey]);

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
      if (selectedRoleKey && getAssignabilityReason(r, selectedRoleKey, event.tipo, regulations)) {
        return false;
      }
      return true;
    });
    return list;
  }, [filterZona, filterNivel, search, referees, selectedRoleKey, regulations, event.tipo]);

  const persistAssign = (slotKey: string, refereeId: string) => {
    const snapshot = assignments;
    const session = slotKey.split("_")[0];
    const sessionTemplate = template.find((item) => item.sesion === session);
    const nextAssignments = { ...snapshot };
    for (const key of Object.keys(nextAssignments)) {
      if (nextAssignments[key] === refereeId && key.split("_")[0] === session) delete nextAssignments[key];
    }
    nextAssignments[slotKey] = refereeId;

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
    if (sessionTemplate) {
      setSelectedSlot(findNextOpenSlot(sessionTemplate, nextAssignments, slotKey));
    } else {
      setSelectedSlot(null);
    }
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
        setSelectedSlot(slotKey);
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
  const groupedSessions = useMemo(() => groupSessionsByDay(template), [template]);
  const activeSession =
    template.find((session) => session.sesion === activeSessionKey) ?? template[0] ?? null;
  const activeSessionPendingSlots = activeSession
    ? collectOpenSlots(activeSession, assignments)
    : [];
  const selectedSlotMeta =
    selectedSlot && activeSession
      ? describeSlot(activeSession, selectedSlot)
      : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <ScheduleImportDialog
        competitionId={event.id}
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
              <Link href="/competitions" aria-label="Volver a campeonatos">
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
              <RosterHistoryPanel competitionId={event.id} />
              {!readOnly && !isEditing && (
                <RosterHeaderActions
                  competitionId={event.id}
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
            Este campeonato aún no tiene plantilla de tarima. Importa el horario PDF de esta competición
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
                  {selectedSlotMeta
                    ? `${selectedSlotMeta.sessionLabel} · ${selectedSlotMeta.roleLabel} ${selectedSlotMeta.slotNumber}`
                    : "Slot seleccionado"}{" "}
                  — haz clic en un juez para asignar
                </span>
              ) : (
                "Arrastra o selecciona un slot primero"
              )}
            </p>
            {selectedSlot && !readOnly && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                <span className="text-[11px] text-primary">
                  Selección activa para asignación rápida
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setSelectedSlot(null)}
                >
                  Cancelar selección
                </Button>
              </div>
            )}
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
                  competitionId={event.id}
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
                  Fin de semana · {template.length} sesión{template.length !== 1 ? "es" : ""}
                </h2>
                <p className="text-xs text-subtle-muted">
                  Vista global por día arriba; detalle operativo abajo
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-4 p-4">
                  <div className="grid gap-3 2xl:grid-cols-2">
                    {groupedSessions.map(([dia, sesiones]) => (
                      <section
                        key={dia}
                        className="rounded-2xl border border-border-muted bg-surface/30 p-3.5"
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                            {dia}
                          </h3>
                        </div>
                        <div className="space-y-2">
                          {sesiones.map((session) => (
                            <SessionOverviewCard
                              key={session.sesion}
                              session={session}
                              assignments={assignments}
                              active={activeSession?.sesion === session.sesion}
                              onClick={() => {
                                setActiveSessionKey(session.sesion);
                                setSelectedSlot(null);
                              }}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>

                  {activeSession ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-subtle-muted">
                            Sesión activa
                          </p>
                          <h3 className="text-sm font-semibold text-foreground">
                            {activeSession.sesion} · {activeSession.nombre}
                          </h3>
                        </div>
                        <p className="text-xs text-subtle-muted">
                          Edita esta sesión sin perder la vista global del fin de semana
                        </p>
                      </div>
                      {!readOnly && (
                        <div className="rounded-2xl border border-border-muted bg-surface/25 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-subtle-muted">
                              Huecos pendientes
                            </p>
                            <span className="font-mono text-[11px] text-subtle-muted">
                              {activeSessionPendingSlots.length} sin cubrir
                            </span>
                          </div>
                          {activeSessionPendingSlots.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {activeSessionPendingSlots.map((slot) => (
                                <button
                                  key={slot.slotKey}
                                  type="button"
                                  onClick={() => setSelectedSlot(slot.slotKey)}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors focus-ring",
                                    selectedSlot === slot.slotKey
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-border bg-background text-muted-foreground hover:border-border-strong hover:bg-surface",
                                  )}
                                >
                                  <span className="font-mono">{slot.sessionLabel}</span>
                                  <ChevronRight className="h-3 w-3" />
                                  <span>{slot.roleLabel}</span>
                                  <span className="font-mono">{slot.slotNumber}</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-success">
                              Sesión completa. Ya no quedan huecos por cubrir.
                            </p>
                          )}
                        </div>
                      )}
                      <SessionBlock
                        key={activeSession.sesion}
                        session={activeSession}
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
                        defaultExpanded
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border-strong bg-background/50 px-4 py-8 text-center text-xs text-subtle-muted">
                      Define una plantilla para empezar a montar el fin de semana.
                    </div>
                  )}
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

function summarizeSessionCategories(session: RosterSession) {
  const categories = (session.categorias ?? [])
    .map((category) => `${category.genero} ${category.pesos}`)
    .join(" · ");
  return categories || "Sin categorías";
}

function slotRoleEntries(session: RosterSession) {
  return [...session.roles, ...(session.pesajeRoles ?? [])];
}

function sessionProgress(session: RosterSession, assignments: AssignmentsMap) {
  const allRoles = slotRoleEntries(session);
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

function findNextOpenSlot(
  session: RosterSession,
  assignments: AssignmentsMap,
  afterSlotKey?: string,
) {
  const orderedSlots = slotRoleEntries(session).flatMap((role) =>
    Array.from({ length: role.slots }, (_, idx) => `${session.sesion}_${role.key}_${idx}`),
  );

  if (orderedSlots.length === 0) return null;
  const startIndex = afterSlotKey ? orderedSlots.indexOf(afterSlotKey) : -1;
  const rotated =
    startIndex >= 0
      ? [...orderedSlots.slice(startIndex + 1), ...orderedSlots.slice(0, startIndex + 1)]
      : orderedSlots;

  return rotated.find((slotKey) => !assignments[slotKey]) ?? null;
}

function describeSlot(session: RosterSession, slotKey: string) {
  const [, roleKey, slotIndexRaw] = slotKey.split("_");
  const role = slotRoleEntries(session).find((entry) => entry.key === roleKey);
  if (!role) return null;
  return {
    slotKey,
    sessionLabel: session.sesion,
    roleLabel: role.rol,
    slotNumber: Number(slotIndexRaw) + 1,
  };
}

function collectOpenSlots(session: RosterSession, assignments: AssignmentsMap) {
  return slotRoleEntries(session).flatMap((role) =>
    Array.from({ length: role.slots }, (_, idx) => {
      const slotKey = `${session.sesion}_${role.key}_${idx}`;
      if (assignments[slotKey]) return null;
      return {
        slotKey,
        sessionLabel: session.sesion,
        roleLabel: role.rol,
        slotNumber: idx + 1,
      };
    }).filter(Boolean) as Array<{
      slotKey: string;
      sessionLabel: string;
      roleLabel: string;
      slotNumber: number;
    }>,
  );
}

function SessionOverviewCard({
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
        "w-full rounded-xl border px-3 py-3 text-left transition-all focus-ring",
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
            <span className="text-sm font-semibold text-foreground">{session.nombre}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {summarizeSessionCategories(session)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-hover px-2 py-1 font-mono text-[11px] text-foreground-secondary">
          {filled}/{slots}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-subtle-muted">
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
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle-muted">
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
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
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
                    "relative rounded-lg border-2 p-2.5 transition-all duration-100",
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
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
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
                        <div className="mt-2 flex flex-wrap gap-1.5">
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
                    <div className="flex min-h-[52px] flex-col items-center justify-center gap-1 text-center">
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
  defaultExpanded = false,
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
  defaultExpanded?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
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
