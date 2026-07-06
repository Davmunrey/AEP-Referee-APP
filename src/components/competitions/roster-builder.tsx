"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/api/error-message";
import { api } from "@/lib/api/client";
import {
  computeRosterCoverage,
  isRosterLockedByApproval,
} from "@/lib/roster-coverage";
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
  getOperationalBlock,
  type RosterWorkflowStep,
} from "@/lib/roster-ui";
import { cn } from "@/lib/utils";
import { ChevronRight, FileUp } from "lucide-react";
import { parseSlotKey } from "@/lib/roster-template";
// Diálogos/editores pesados: se cargan bajo demanda (al abrirlos), no en el
// bundle inicial de la ruta de tarima (la más pesada de la app).
const RosterTemplateEditor = dynamic(
  () => import("@/components/competitions/roster-template-editor").then((m) => m.RosterTemplateEditor),
  { ssr: false },
);
const ScheduleImportDialog = dynamic(
  () => import("@/components/competitions/schedule-import-dialog").then((m) => m.ScheduleImportDialog),
  { ssr: false },
);
const QuadrantImportDialog = dynamic(
  () => import("@/components/competitions/quadrant-import-dialog").then((m) => m.QuadrantImportDialog),
  { ssr: false },
);
const CompetitionAvailabilityDialog = dynamic(
  () => import("@/components/competitions/competition-availability-dialog").then((m) => m.CompetitionAvailabilityDialog),
  { ssr: false },
);
const EditCompetitionDialog = dynamic(
  () => import("@/components/competitions/edit-competition-dialog").then((m) => m.EditCompetitionDialog),
  { ssr: false },
);
import { RosterCompetitionHeader } from "./roster-competition-header";
import { RosterImprevistoBanner } from "./roster-imprevisto-banner";
import { RosterRefereePanelLeft } from "./roster-referee-panel";
import { SessionBlock, SessionTab } from "./roster-session-block";
import {
  assignedRefereeIdsInSession,
  collectOpenSlots,
  describeSlot,
  findNextOpenSlot,
  groupSessionsByDay,
} from "./roster-session-helpers";

interface RosterBuilderProps {
  competition: Competition;
  template: RosterSession[];
  initialAssignments: AssignmentsMap;
  initialFlags?: FlagsMap;
  initialCrossZoneMap?: CrossZoneMap;
  canEdit?: boolean;
  canManageCompensation?: boolean;
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
  canManageCompensation = false,
  isPast = false,
  referees,
  zones,
  levels,
  regulations = [],
  initialConfirmedIds = [],
  defaultZonaFilter = "TODAS",
}: RosterBuilderProps) {
  const router = useRouter();
  const readOnly = !canEdit;
  const [aprobacion, setAprobacion] = useState(competition.aprobacion);
  const approvalLocked = isRosterLockedByApproval(aprobacion);
  const rosterReadOnly = readOnly || approvalLocked;
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
  // Difiere el filtrado/ranking (caro) respecto al input: escribir sigue fluido.
  const deferredSearch = useDeferredValue(search);
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

  useEffect(() => {
    setAprobacion(competition.aprobacion);
  }, [competition.aprobacion]);

  const coverage = useMemo(
    () => computeRosterCoverage(template, assignments, competition.requeridos),
    [template, assignments, competition.requeridos],
  );
  const { requeridos: totalSlots, confirmados: filledSlots, openSlots, pct: fillPct } = coverage;
  const plantillaDone = totalSlots > 0;
  const asignacionDone = filledSlots > 0;

  // Reconcilia los datos del servidor (estado/cobertura de la competición) tras
  // guardar. Debounced: al rellenar una tarima se hacen muchas asignaciones
  // seguidas; en vez de recargar todo el árbol en cada una (lento), se coalescen
  // en un único refresco ~800 ms después de la última. El estado local ya se
  // actualiza al instante desde la respuesta de la API.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCompetitionList = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 800);
  }, [router]);
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (isEditing || pending) return;
    setTemplate(initialTemplate);
    setAssignments(initialAssignments);
    setFlags(initialFlags);
    setCrossZoneMap(initialCrossZoneMap);
    setAprobacion(competition.aprobacion);
  }, [
    competition.aprobacion,
    initialAssignments,
    initialFlags,
    initialCrossZoneMap,
    initialTemplate,
    isEditing,
    pending,
  ]);

  const handleUnlockImprevisto = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "¿Registrar un imprevisto y desbloquear la tarima para cambios?\n\nDeberás volver a enviar la propuesta a aprobación cuando termines.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await api.unlockRosterImprevisto(competition.id);
        setAprobacion(res.aprobacion);
        setStatusMsg(res.message);
        setStatusIsError(false);
        refreshCompetitionList();
      } catch (err) {
        setStatusMsg(formatApiError(err, "No se pudo registrar el imprevisto"));
        setStatusIsError(true);
      }
    });
  };

  useEffect(() => { if (totalSlots === 0) setWorkflowStep("plantilla"); }, [totalSlots]);

  useEffect(() => {
    if (template.length === 0) { setActiveSessionKey(null); return; }
    if (!activeSessionKey || !template.some((s) => s.sesion === activeSessionKey)) {
      setActiveSessionKey(template[0]?.sesion ?? null);
    }
  }, [template, activeSessionKey]);

  const activeSessionAssignedIds = useMemo(
    () => assignedRefereeIdsInSession(assignments, activeSessionKey),
    [assignments, activeSessionKey],
  );
  // Índice por id: evita el find O(n) repetido por slot/render en toda la tarima.
  const refereeById = useMemo(
    () => new Map(referees.map((r) => [r.id, r])),
    [referees],
  );
  const getReferee = useCallback((id: string) => refereeById.get(id), [refereeById]);
  const checkViolation = useCallback(
    (roleKey: RoleKey, refereeId: string) => {
      const ref = refereeById.get(refereeId);
      if (!ref) return undefined;
      return findRegulationViolation(roleKey, competition.tipo, ref.nivel, regulations);
    },
    [refereeById, competition.tipo, regulations],
  );
  const violationCount = useMemo(
    () => countRegulationViolations(template, assignments, competition.tipo, (id) => refereeById.get(id)?.nivel, regulations),
    [assignments, template, regulations, competition.tipo, refereeById],
  );
  const selectedRoleKey = selectedSlot ? parseSlotKey(selectedSlot)?.roleKey : undefined;

  const availableReferees = useMemo(() => referees.filter((r) => {
    if (r.estado !== "Activo" || !r.disp) return false;
    if (filterOnlyConfirmed && !confirmedIds.has(r.id)) return false;
    // Selección rápida = solo disponibles: al elegir un hueco, si hay
    // disponibilidad confirmada para la competición, se ocultan los no
    // confirmados (la selección rápida va DESPUÉS del paso de disponibilidad).
    if (selectedSlot && confirmedIds.size > 0 && !confirmedIds.has(r.id)) return false;
    if (filterZona !== "TODAS" && r.zona !== filterZona) return false;
    if (filterNivel !== "TODOS" && r.nivel !== filterNivel) return false;
    if (deferredSearch) {
      const q = deferredSearch.toLowerCase();
      if (!r.nombre.toLowerCase().includes(q) && !(r.iniciales ?? "").toLowerCase().includes(q)) return false;
    }
    if (selectedRoleKey && getAssignabilityReason(r, selectedRoleKey, competition.tipo, regulations)) return false;
    if (selectedSlot) {
      // Los conflictos forzables (solape tarima/pesaje) se muestran como aviso y se
      // pueden confirmar; solo se ocultan los bloqueos duros (mismo puesto repetido).
      const block = getOperationalBlock({ template, assignments, slotKey: selectedSlot, refereeId: r.id, flags });
      if (block && !block.overridable) return false;
    }
    return true;
  }), [assignments, competition.tipo, confirmedIds, filterNivel, filterOnlyConfirmed, filterZona, flags, referees, regulations, deferredSearch, selectedRoleKey, selectedSlot, template]);

  const persistAssign = (slotKey: string, refereeId: string) => {
    const block = getOperationalBlock({ template, assignments, slotKey, refereeId, flags });
    let forceShared = false;
    if (block) {
      if (!block.overridable) { setStatusMsg(block.reason); setStatusIsError(true); return; }
      // Conflicto forzable: avisamos y, si se confirma, marcamos el puesto como
      // compartido (*) para dejar constancia en el acta y permitir el solape.
      const proceed =
        typeof window !== "undefined" &&
        window.confirm(`${block.reason}\n\n¿Asignar de todas formas y marcar el puesto como compartido (*)?`);
      if (!proceed) return;
      forceShared = true;
    }
    const snapshot = assignments;
    const flagsSnapshot = flags;
    const session = parseSlotKey(slotKey)?.session;
    const sessionTpl = session ? template.find((item) => item.sesion === session) : undefined;
    const nextAssignments = { ...snapshot, [slotKey]: refereeId };
    const flagPayload = forceShared
      ? { compartido: true, intercambio: Boolean(flags[slotKey]?.intercambio) }
      : undefined;
    setAssignments(() => ({ ...snapshot, [slotKey]: refereeId }));
    if (flagPayload) setFlags((prev) => ({ ...prev, [slotKey]: flagPayload }));
    if (sessionTpl) setSelectedSlot(findNextOpenSlot(sessionTpl, nextAssignments, slotKey));
    else setSelectedSlot(null);
    startTransition(async () => {
      try {
        const res = await api.assignReferee(competition.id, slotKey, refereeId, flagPayload);
        setAssignments(res.assignments);
        if (res.flags) setFlags(res.flags);
        if (res.crossZoneMap) setCrossZoneMap(res.crossZoneMap);
        setStatusMsg(null); setStatusIsError(false);
        refreshCompetitionList();
      } catch (err) {
        setAssignments(snapshot); setFlags(flagsSnapshot); setSelectedSlot(slotKey);
        setStatusMsg(formatApiError(err, "No se pudo guardar la asignación")); setStatusIsError(true);
      }
    });
  };

  const persistClear = (slotKey: string) => {
    const snapshot = assignments;
    setAssignments((prev) => { const next = { ...prev }; delete next[slotKey]; return next; });
    startTransition(async () => {
      try { const res = await api.clearSlot(competition.id, slotKey); setAssignments(res.assignments); setStatusMsg(null); setStatusIsError(false); }
      catch (err) { setAssignments(snapshot); setStatusMsg(formatApiError(err, "No se pudo quitar la asignación")); setStatusIsError(true); }
    });
  };

  const onDrop = (slotKey: string, refereeId: string) => {
    if (rosterReadOnly) return;
    persistAssign(slotKey, refereeId);
    setDraggedId(null); setSelectedSlot(null);
  };

  const onQuickAssign = (refereeId: string) => { if (!selectedSlot || rosterReadOnly) return; persistAssign(selectedSlot, refereeId); };

  const toggleFlag = (slotKey: string, field: keyof SlotFlags) => {
    if (rosterReadOnly || !assignments[slotKey]) return;
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
    if (rosterReadOnly || filledSlots === 0 || pending) return;
    if (!confirm(`¿Vaciar todas las asignaciones de jueces de ${competition.nombre}?\n\nLa plantilla se mantiene, solo se liberan los huecos.`)) return;
    const sa = assignments; const sf = flags;
    setAssignments({}); setFlags({}); setSelectedSlot(null);
    startTransition(async () => {
      try { const res = await api.clearRosterAssignments(competition.id); setAssignments(res.assignments); setFlags(res.flags); setStatusMsg("Asignaciones borradas"); setStatusIsError(false); refreshCompetitionList(); }
      catch (err) { setAssignments(sa); setFlags(sf); setStatusMsg(formatApiError(err, "No se pudieron borrar las asignaciones")); setStatusIsError(true); }
    });
  };

  const clearTemplateAndAssignments = () => {
    if (rosterReadOnly || template.length === 0 || pending || savingTemplate) return;
    if (!confirm(`¿Borrar la plantilla de tarima de ${competition.nombre}?\n\nEsto elimina sesiones, huecos y asignaciones. Podrás importar el horario de nuevo.`)) return;
    const st = template; const sa = assignments; const sf = flags;
    setTemplate([]); setAssignments({}); setFlags({}); setSelectedSlot(null); setActiveSessionKey(null); setWorkflowStep("plantilla");
    startTransition(async () => {
      try {
        const res = await api.clearRosterTemplate(competition.id);
        setTemplate(res.template); setAssignments(res.assignments); setFlags(res.flags);
        setIsEditing(false); setStatusMsg("Plantilla borrada"); setStatusIsError(false); refreshCompetitionList();
      } catch (err) { setTemplate(st); setAssignments(sa); setFlags(sf); setStatusMsg(formatApiError(err, "No se pudo borrar la plantilla")); setStatusIsError(true); }
    });
  };

  const isDragging = draggedId !== null;
  // El panel de jueces solo tiene sentido al asignar. Al editar la plantilla (o en
  // la vista de estructura) estorba y deja el editor apretado: lo ocultamos y damos
  // el ancho completo al contenido.
  const showRefereePanel = !isEditing && workflowStep === "asignacion";
  const groupedSessions = useMemo(() => groupSessionsByDay(template), [template]);
  const activeSession = template.find((s) => s.sesion === activeSessionKey) ?? template[0] ?? null;
  const activeSessionPendingSlots = activeSession ? collectOpenSlots(activeSession, assignments) : [];
  const selectedSlotMeta = selectedSlot && activeSession ? describeSlot(activeSession, selectedSlot) : null;

  return (
    <>
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
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
          competition={{ ...competition, aprobacion }}
          isPast={isPast} canEdit={canEdit}
          canManageCompensation={canManageCompensation}
          rosterLocked={approvalLocked}
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
        <RosterImprevistoBanner
          aprobacion={aprobacion}
          canEdit={canEdit}
          pending={pending}
          onUnlock={handleUnlockImprevisto}
        />
        {!readOnly && (
          <>
            <RosterHelpPanel />
            <RosterStepper
              current={isEditing ? "plantilla" : workflowStep}
              onChange={(step) => {
                setWorkflowStep(step);
                // "Plantilla" = trabajar la ESTRUCTURA. Si ya existe plantilla, abre el
                // editor de sesiones directamente; antes mostraba la tarima en solo
                // lectura (lo mismo que Asignación sin el panel de jueces), que no aporta.
                setIsEditing(step === "plantilla" && totalSlots > 0);
              }}
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
          <div
            className={cn(
              "grid min-h-0 flex-1 grid-cols-1",
              showRefereePanel &&
                "md:grid-cols-[minmax(0,220px)_1fr] lg:grid-cols-[minmax(0,252px)_1fr] xl:grid-cols-[minmax(0,272px)_1fr] 2xl:grid-cols-[minmax(0,292px)_1fr]",
            )}
          >
            {showRefereePanel && (
              <RosterRefereePanelLeft
                referees={availableReferees} assignedIds={activeSessionAssignedIds}
                canEdit={canEdit} readOnly={rosterReadOnly}
                selectedSlot={selectedSlot} selectedSlotMeta={selectedSlotMeta}
                confirmedIds={confirmedIds} filterOnlyConfirmed={filterOnlyConfirmed}
                filterZona={filterZona} filterNivel={filterNivel} search={search}
                zones={zones} levels={levels} isDragging={isDragging} draggedId={draggedId}
                competitionTipo={competition.tipo} competitionZona={competition.zona}
                regulations={regulations} template={template} assignments={assignments} flags={flags}
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
                  <div className="shrink-0 border-b border-border-muted bg-surface/20">
                    <div className="flex items-center gap-4 overflow-x-auto px-3 py-2">
                      {groupedSessions.map(([dia, sesiones]) => (
                        <div key={dia} className="flex shrink-0 items-center gap-2">
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                            {dia}
                          </span>
                          {sesiones.map((session) => (
                            <SessionTab
                              key={session.sesion}
                              session={session}
                              assignments={assignments}
                              active={activeSession?.sesion === session.sesion}
                              onClick={() => { setActiveSessionKey(session.sesion); setSelectedSlot(null); }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-2 p-3">
                      {activeSession ? (
                        <div className="space-y-2">
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
                            readOnly={rosterReadOnly} isDragging={isDragging} defaultExpanded
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
          competitionId={competition.id} referees={referees}
          confirmedIds={confirmedIds} canEdit={canEdit}
          onClose={() => {
            setAvailabilityOpen(false);
            // Un único refresco al cerrar reconcilia el servidor, en vez de
            // recargar todo el árbol en cada clic (lo que hacía lentísimo marcar).
            router.refresh();
          }}
          onToggle={(id, confirmed) =>
            setConfirmedIds((prev) => {
              const next = new Set(prev);
              if (confirmed) next.add(id);
              else next.delete(id);
              return next;
            })
          }
        />
      )}
    </>
  );
}
