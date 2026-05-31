"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatApiError } from "@/lib/api/error-message";
import { api } from "@/lib/api/client";
import { RosterHelpPanel } from "@/components/competitions/roster-help-panel";
import { RosterRevisionPanel } from "@/components/competitions/roster-revision-panel";
import { RosterStepper } from "@/components/competitions/roster-stepper";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  AssignmentsMap,
  Competition,
  CrossZoneMap,
  FlagsMap,
  Referee,
  RefereeLevel,
  RegulationRule,
  RoleKey,
  RosterSession,
  SlotFlags,
  Zone,
} from "@/lib/types";
import {
  countRegulationViolations,
  findRegulationViolation,
  getAssignabilityReason,
  getOperationalBlockReason,
  type RosterWorkflowStep,
} from "@/lib/roster-ui";
import { cn } from "@/lib/utils";
import { ChevronRight, FileUp } from "lucide-react";
import { RosterTemplateEditor } from "@/components/competitions/roster-template-editor";
import { ScheduleImportDialog } from "@/components/competitions/schedule-import-dialog";
import { QuadrantImportDialog } from "@/components/competitions/quadrant-import-dialog";
import { CompetitionAvailabilityDialog } from "@/components/competitions/competition-availability-dialog";
import { EditCompetitionDialog } from "@/components/competitions/edit-competition-dialog";
import { RosterCompetitionHeader } from "./roster-competition-header";
import { RosterRefereePanelLeft } from "./roster-referee-panel";
import { SessionBlock, SessionOverviewCard } from "./roster-session-block";
import { collectOpenSlots, describeSlot, findNextOpenSlot, groupSessionsByDay } from "./roster-session-helpers";

interface RosterBuilderProps {
  competition: Competition;
  template: RosterSession[];
  initialAssignments: AssignmentsMap;
  initialFlags?: FlagsMap;
  initialCrossZoneMap?: CrossZoneMap;
  canEdit?: boolean;
  /** Campeonato finalizado — contexto histórico visual. */
  isPast?: boolean;
  referees: Referee[];
  zones: Zone[];
  levels: RefereeLevel[];
  regulations?: RegulationRule[];
  initialConfirmedIds?: string[];
  defaultZonaFilter?: string;
}

export function RosterBuilder({
  competition,
  template: initialTemplate,
  initialAssignments,
  initialFlags = {},
  initialCrossZoneMap = {},
  canEdit = false,
  isPast = false,
  referees,
  zones,
  levels,
  regulations = [],
  initialConfirmedIds = [],
  defaultZonaFilter = "TODAS",
}: RosterBuilderProps) {
  const readOnly = !canEdit;
  const [template, setTemplate] = useState(initialTemplate);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [flags, setFlags] = useState<FlagsMap>(initialFlags);
  const [crossZoneMap, setCrossZoneMap] = useState<CrossZoneMap>(initialCrossZoneMap);
  const [isEditing, setIsEditing] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [quadrantImportOpen, setQuadrantImportOpen] = useState(false);
  const [filterZona, setFilterZona] = useState(defaultZonaFilter);
  const [filterNivel, setFilterNivel] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set(initialConfirmedIds));
  const [filterOnlyConfirmed, setFilterOnlyConfirmed] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [editCompetitionOpen, setEditCompetitionOpen] = useState(false);
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(initialTemplate[0]?.sesion ?? null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [workflowStep, setWorkflowStep] = useState<RosterWorkflowStep>("asignacion");

  const totalSlots = template.reduce(
    (acc, s) => acc + s.roles.reduce((a, r) => a + r.slots, 0) + (s.pesajeRoles ?? []).reduce((a, r) => a + r.slots, 0),
    0,
  );
  const filledSlots = Object.values(assignments).filter(Boolean).length;
  const fillPct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
  const openSlots = Math.max(0, totalSlots - filledSlots);
  const plantillaDone = totalSlots > 0;
  const asignacionDone = filledSlots > 0;

  useEffect(() => { if (totalSlots === 0) setWorkflowStep("plantilla"); }, [totalSlots]);

  useEffect(() => {
    if (template.length === 0) { setActiveSessionKey(null); return; }
    if (!activeSessionKey || !template.some((s) => s.sesion === activeSessionKey)) {
      setActiveSessionKey(template[0]?.sesion ?? null);
    }
  }, [template, activeSessionKey]);

  const assignedIds = useMemo(() => new Set(Object.values(assignments).filter(Boolean)), [assignments]);
  const getReferee = (id: string) => referees.find((r) => r.id === id);
  const checkViolation = (roleKey: RoleKey, refereeId: string) => {
    const ref = getReferee(refereeId);
    if (!ref) return undefined;
    return findRegulationViolation(roleKey, competition.tipo, ref.nivel, regulations);
  };
  const violationCount = useMemo(
    () => countRegulationViolations(template, assignments, competition.tipo, (id) => referees.find((r) => r.id === id)?.nivel, regulations),
    [assignments, template, regulations, competition.tipo, referees],
  );
  const selectedRoleKey = selectedSlot ? (selectedSlot.split("_")[1] as RoleKey | undefined) : undefined;

  const availableReferees = useMemo(() => referees.filter((r) => {
    if (r.estado !== "Activo" || !r.disp) return false;
    if (filterOnlyConfirmed && !confirmedIds.has(r.id)) return false;
    if (filterZona !== "TODAS" && r.zona !== filterZona) return false;
    if (filterNivel !== "TODOS" && r.nivel !== filterNivel) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.nombre.toLowerCase().includes(q) && !(r.iniciales ?? "").toLowerCase().includes(q)) return false;
    }
    if (selectedRoleKey && getAssignabilityReason(r, selectedRoleKey, competition.tipo, regulations)) return false;
    if (selectedSlot && getOperationalBlockReason({ template, assignments, slotKey: selectedSlot, refereeId: r.id })) return false;
    return true;
  }), [assignments, competition.tipo, confirmedIds, filterNivel, filterOnlyConfirmed, filterZona, referees, regulations, search, selectedRoleKey, selectedSlot, template]);

  const persistAssign = (slotKey: string, refereeId: string) => {
    const block = getOperationalBlockReason({ template, assignments, slotKey, refereeId });
    if (block) { setStatusMsg(block); setStatusIsError(true); return; }
    const snapshot = assignments;
    const session = slotKey.split("_")[0];
    const sessionTpl = template.find((item) => item.sesion === session);
    const nextAssignments = { ...snapshot, [slotKey]: refereeId };
    setAssignments(() => ({ ...snapshot, [slotKey]: refereeId }));
    if (sessionTpl) setSelectedSlot(findNextOpenSlot(sessionTpl, nextAssignments, slotKey));
    else setSelectedSlot(null);
    startTransition(async () => {
      try {
        const res = await api.assignReferee(competition.id, slotKey, refereeId);
        setAssignments(res.assignments);
        if (res.flags) setFlags(res.flags);
        if (res.crossZoneMap) setCrossZoneMap(res.crossZoneMap);
        setStatusMsg(null); setStatusIsError(false);
      } catch (err) {
        setAssignments(snapshot); setSelectedSlot(slotKey);
        setStatusMsg(formatApiError(err, "No se pudo guardar la asignación")); setStatusIsError(true);
      }
    });
  };

  const persistClear = (slotKey: string) => {
    setAssignments((prev) => { const next = { ...prev }; delete next[slotKey]; return next; });
    startTransition(async () => {
      try { const res = await api.clearSlot(competition.id, slotKey); setAssignments(res.assignments); }
      catch (err) { setStatusMsg(formatApiError(err, "No se pudo quitar la asignación")); setStatusIsError(true); }
    });
  };

  const onDrop = (slotKey: string, refereeId: string) => {
    if (readOnly) return;
    persistAssign(slotKey, refereeId);
    setDraggedId(null); setSelectedSlot(null);
  };

  const onQuickAssign = (refereeId: string) => { if (!selectedSlot || readOnly) return; persistAssign(selectedSlot, refereeId); };

  const toggleFlag = (slotKey: string, field: keyof SlotFlags) => {
    if (readOnly || !assignments[slotKey]) return;
    const next: SlotFlags = { ...(flags[slotKey] ?? {}), [field]: !(flags[slotKey]?.[field]) };
    const snapshot = flags;
    setFlags((prev) => ({ ...prev, [slotKey]: next }));
    startTransition(async () => {
      try { const res = await api.setSlotFlags(competition.id, slotKey, next); setFlags(res.flags); }
      catch (err) { setFlags(snapshot); setStatusMsg(formatApiError(err, "No se pudieron guardar los marcadores del slot")); setStatusIsError(true); }
    });
  };

  const saveTemplate = (next: RosterSession[]) => {
    setSavingTemplate(true);
    startTransition(async () => {
      try {
        const res = await api.saveTemplate(competition.id, next);
        setTemplate(res.template); setAssignments(res.assignments); setFlags(res.flags);
        setIsEditing(false); setWorkflowStep("asignacion");
        setStatusMsg("Plantilla guardada"); setStatusIsError(false);
      } catch (err) { setStatusMsg(formatApiError(err, "No se pudo guardar la plantilla")); setStatusIsError(true); }
      finally { setSavingTemplate(false); }
    });
  };

  const clearAllAssignments = () => {
    if (readOnly || filledSlots === 0 || pending) return;
    if (!confirm(`¿Vaciar todas las asignaciones de jueces de ${competition.nombre}?\n\nLa plantilla se mantiene, solo se liberan los huecos.`)) return;
    const sa = assignments; const sf = flags;
    setAssignments({}); setFlags({}); setSelectedSlot(null);
    startTransition(async () => {
      try { const res = await api.clearRosterAssignments(competition.id); setAssignments(res.assignments); setFlags(res.flags); setStatusMsg("Asignaciones borradas"); setStatusIsError(false); }
      catch (err) { setAssignments(sa); setFlags(sf); setStatusMsg(formatApiError(err, "No se pudieron borrar las asignaciones")); setStatusIsError(true); }
    });
  };

  const clearTemplateAndAssignments = () => {
    if (readOnly || template.length === 0 || pending || savingTemplate) return;
    if (!confirm(`¿Borrar la plantilla de tarima de ${competition.nombre}?\n\nEsto elimina sesiones, huecos y asignaciones. Podrás importar el horario de nuevo.`)) return;
    const st = template; const sa = assignments; const sf = flags;
    setTemplate([]); setAssignments({}); setFlags({}); setSelectedSlot(null); setActiveSessionKey(null); setWorkflowStep("plantilla");
    startTransition(async () => {
      try {
        const res = await api.clearRosterTemplate(competition.id);
        setTemplate(res.template); setAssignments(res.assignments); setFlags(res.flags);
        setIsEditing(false); setStatusMsg("Plantilla borrada"); setStatusIsError(false);
      } catch (err) { setTemplate(st); setAssignments(sa); setFlags(sf); setStatusMsg(formatApiError(err, "No se pudo borrar la plantilla")); setStatusIsError(true); }
    });
  };

  const isDragging = draggedId !== null;
  const groupedSessions = useMemo(() => groupSessionsByDay(template), [template]);
  const activeSession = template.find((s) => s.sesion === activeSessionKey) ?? template[0] ?? null;
  const activeSessionPendingSlots = activeSession ? collectOpenSlots(activeSession, assignments) : [];
  const selectedSlotMeta = selectedSlot && activeSession ? describeSlot(activeSession, selectedSlot) : null;

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <ScheduleImportDialog
          competitionId={competition.id}
          open={importOpen}
          hasExistingTemplate={template.length > 0}
          onClose={() => setImportOpen(false)}
          onApplied={(tpl) => { setTemplate(tpl); setImportOpen(false); setWorkflowStep("asignacion"); setStatusMsg("Plantilla importada desde PDF"); setStatusIsError(false); }}
        />
        <QuadrantImportDialog
          competitionId={competition.id}
          open={quadrantImportOpen}
          onClose={() => setQuadrantImportOpen(false)}
          onApplied={(nextAssignments, nextFlags) => { setAssignments(nextAssignments); if (nextFlags) setFlags(nextFlags); setQuadrantImportOpen(false); setWorkflowStep("asignacion"); setStatusMsg("Cuadrante aplicado"); setStatusIsError(false); }}
        />
        <RosterCompetitionHeader
          competition={competition} isPast={isPast} canEdit={canEdit}
          violationCount={violationCount} filledSlots={filledSlots} totalSlots={totalSlots}
          fillPct={fillPct} openSlots={openSlots} pending={pending} savingTemplate={savingTemplate}
          isEditing={isEditing} statusMsg={statusMsg} statusIsError={statusIsError}
          templateLength={template.length}
          onOpenEdit={() => setEditCompetitionOpen(true)}
          onOpenImport={() => setImportOpen(true)}
          onOpenQuadrant={() => setQuadrantImportOpen(true)}
          clearAllAssignments={clearAllAssignments}
          clearTemplateAndAssignments={clearTemplateAndAssignments}
          onStatus={(msg, isError) => { setStatusMsg(msg); setStatusIsError(isError ?? false); }}
          startTransition={startTransition}
          onToggleEditing={() => {
            if (isEditing) { setIsEditing(false); setWorkflowStep(totalSlots > 0 ? "asignacion" : "plantilla"); }
            else { setIsEditing(true); setWorkflowStep("plantilla"); }
          }}
        />
        {!readOnly && (
          <>
            <RosterHelpPanel />
            <RosterStepper
              current={isEditing ? "plantilla" : workflowStep}
              onChange={(step) => { setIsEditing(false); setWorkflowStep(step); }}
              disabled={pending || savingTemplate}
              plantillaDone={plantillaDone}
              asignacionDone={asignacionDone}
            />
          </>
        )}
        {workflowStep === "revision" && !isEditing && !readOnly ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <RosterRevisionPanel filledSlots={filledSlots} totalSlots={totalSlots} fillPct={fillPct} violationCount={violationCount} openSlots={openSlots} onGoAssign={() => setWorkflowStep("asignacion")} />
          </div>
        ) : workflowStep === "plantilla" && !isEditing && totalSlots === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              Este campeonato aún no tiene plantilla de tarima. Importa el horario PDF de esta competición o define sesiones y plazas manualmente.
            </p>
            {canEdit && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" className="gap-1.5" onClick={() => setImportOpen(true)} disabled={pending}>
                  <FileUp className="h-3.5 w-3.5" />Importar horario (PDF)
                </Button>
                <Button type="button" variant="outline" onClick={() => { setIsEditing(true); setWorkflowStep("plantilla"); }} disabled={pending}>
                  Crear plantilla manual
                </Button>
              </div>
            )}
            <p className="text-[11px] text-subtle-muted">El calendario anual (varios campeonatos) se importa desde la lista de Campeonatos.</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,240px)_1fr] lg:grid-cols-[minmax(0,280px)_1fr] xl:grid-cols-[minmax(0,320px)_1fr]">
            {(workflowStep === "asignacion" || isEditing) && (
              <RosterRefereePanelLeft
                referees={availableReferees} assignedIds={assignedIds}
                canEdit={canEdit} readOnly={readOnly}
                selectedSlot={selectedSlot} selectedSlotMeta={selectedSlotMeta}
                confirmedIds={confirmedIds} filterOnlyConfirmed={filterOnlyConfirmed}
                filterZona={filterZona} filterNivel={filterNivel} search={search}
                zones={zones} levels={levels} isDragging={isDragging} draggedId={draggedId}
                competitionTipo={competition.tipo} competitionZona={competition.zona}
                regulations={regulations} template={template} assignments={assignments}
                selectedRoleKey={selectedRoleKey}
                onSelectSlot={setSelectedSlot} onAvailabilityOpen={() => setAvailabilityOpen(true)}
                onFilterZona={setFilterZona} onFilterNivel={setFilterNivel}
                onSearch={setSearch} onFilterConfirmed={setFilterOnlyConfirmed}
                onDragStart={(id) => setDraggedId(id)} onDragEnd={() => setDraggedId(null)}
                onQuickAssign={onQuickAssign}
              />
            )}
            <section className="flex flex-col overflow-hidden">
              {isEditing ? (
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    <RosterTemplateEditor competitionId={competition.id} initialTemplate={template} onSave={saveTemplate} onCancel={() => setIsEditing(false)} saving={savingTemplate} />
                  </div>
                </ScrollArea>
              ) : (
                <>
                  <div className="border-b border-border px-4 py-2.5">
                    <h2 className="text-sm font-semibold text-foreground-secondary">Fin de semana · {template.length} sesión{template.length !== 1 ? "es" : ""}</h2>
                    <p className="text-xs text-subtle-muted">Vista global por día arriba; detalle operativo abajo</p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-3 p-3">
                      <div className="grid gap-3 2xl:grid-cols-2">
                        {groupedSessions.map(([dia, sesiones]) => (
                          <section key={dia} className="rounded-xl border border-border-muted bg-surface/30 p-3">
                            <div className="mb-3 flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{dia}</h3>
                            </div>
                            <div className="space-y-1.5">
                              {sesiones.map((session) => (
                                <SessionOverviewCard
                                  key={session.sesion} session={session} assignments={assignments}
                                  active={activeSession?.sesion === session.sesion}
                                  onClick={() => { setActiveSessionKey(session.sesion); setSelectedSlot(null); }}
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
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-subtle-muted">Sesión activa</p>
                              <h3 className="text-sm font-semibold text-foreground">{activeSession.sesion} · {activeSession.nombre}</h3>
                            </div>
                            <p className="text-xs text-subtle-muted">Edita esta sesión sin perder la vista global del fin de semana</p>
                          </div>
                          {!readOnly && (
                            <div className="rounded-2xl border border-border-muted bg-surface/25 p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-subtle-muted">Huecos pendientes</p>
                                <span className="font-mono text-[11px] text-subtle-muted">{activeSessionPendingSlots.length} sin cubrir</span>
                              </div>
                              {activeSessionPendingSlots.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {activeSessionPendingSlots.map((slot) => (
                                    <button
                                      key={slot.slotKey} type="button" onClick={() => setSelectedSlot(slot.slotKey)}
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors focus-ring",
                                        selectedSlot === slot.slotKey ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-border-strong hover:bg-surface",
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
                                <p className="text-xs text-success">Sesión completa. Ya no quedan huecos por cubrir.</p>
                              )}
                            </div>
                          )}
                          <SessionBlock
                            key={activeSession.sesion} session={activeSession}
                            assignments={assignments} flags={flags} crossZoneMap={crossZoneMap}
                            getReferee={getReferee} selectedSlot={selectedSlot}
                            onSelectSlot={setSelectedSlot} onDrop={onDrop} onClear={persistClear}
                            onToggleFlag={toggleFlag} checkViolation={checkViolation}
                            readOnly={readOnly} isDragging={isDragging} defaultExpanded
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
      <EditCompetitionDialog competition={competition} zones={zones} open={editCompetitionOpen} onClose={() => setEditCompetitionOpen(false)} />
      {availabilityOpen && (
        <CompetitionAvailabilityDialog
          competitionId={competition.id} referees={referees} zones={zones}
          confirmedIds={confirmedIds} canEdit={canEdit}
          onClose={() => setAvailabilityOpen(false)}
          onToggle={(id, confirmed) =>
            setConfirmedIds((prev) => { const next = new Set(prev); confirmed ? next.add(id) : next.delete(id); return next; })
          }
        />
      )}
    </>
  );
}
