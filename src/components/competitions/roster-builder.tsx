"use client";

import { rosterTemplateHash } from "@/lib/roster-template-hash";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ApiRequestError } from "@/lib/api/request";
import { formatApiError } from "@/lib/api/error-message";
import { api } from "@/lib/api/client";
import {
  computeRosterCoverage,
  countRequiredSlots,
  isRosterFrozen,
  isRosterLockedByApproval,
  isRosterPendingApproval,
} from "@/lib/roster-coverage";
import { RosterHelpPanel } from "@/components/competitions/roster-help-panel";
import { RosterStepper } from "@/components/competitions/roster-stepper";
import type { RefereeBusyMap } from "@/lib/roster-conflicts";
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
import { AlertTriangle, ChevronRight, FileUp } from "lucide-react";
import { parseSlotKey } from "@/lib/roster-template";
import { isConvocatoriaAbierta, type ConvocatoriaStaffView, type DesignacionRespuesta } from "@/lib/convocatorias";
// Diálogos/editores pesados: se cargan bajo demanda (al abrirlos), no en el
// bundle inicial de la ruta de tarima (la más pesada de la app).
// Solo se ve en el paso «Revisión»: no tiene por qué ir en la carga inicial.
const RosterRevisionPanel = dynamic(
  () => import("@/components/competitions/roster-revision-panel").then((m) => m.RosterRevisionPanel),
  { ssr: false },
);
const RosterTemplateEditor = dynamic(
  () => import("@/components/competitions/roster-template-editor").then((m) => m.RosterTemplateEditor),
  { ssr: false },
);
const ScheduleImportDialog = dynamic(
  () => import("@/components/competitions/schedule-import-dialog").then((m) => m.ScheduleImportDialog),
  { ssr: false },
);
const EMPTY_RESPUESTAS: Readonly<Record<string, DesignacionRespuesta>> = {};

const QuadrantImportDialog = dynamic(
  () => import("@/components/competitions/quadrant-import-dialog").then((m) => m.QuadrantImportDialog),
  { ssr: false },
);
const CompetitionAvailabilityDialog = dynamic(
  () => import("@/components/competitions/competition-availability-dialog").then((m) => m.CompetitionAvailabilityDialog),
  { ssr: false },
);
const ConvocatoriaDialog = dynamic(
  () => import("@/components/competitions/convocatoria-dialog").then((m) => m.ConvocatoriaDialog),
  { ssr: false },
);
const EditCompetitionDialog = dynamic(
  () => import("@/components/competitions/edit-competition-dialog").then((m) => m.EditCompetitionDialog),
  { ssr: false },
);
import { RosterCompetitionHeader } from "./roster-competition-header";
import { RosterImprevistoBanner, type RosterLastReview } from "./roster-imprevisto-banner";
import { RosterRefereePanelLeft } from "./roster-referee-panel";
import { SessionBlock, SessionTab } from "./roster-session-block";
import {
  assignedRefereeIdsInSession,
  collectOpenSlots,
  describeSlot,
  findNextOpenSlot,
  groupSessionsByDay,
} from "./roster-session-helpers";
import { zonesMatch } from "@/lib/aep-zones";
import { confirmar } from "@/components/ui/confirm-dialog";

// Defaults estables a nivel de módulo: un literal `{}` inline crearía un objeto
// nuevo por render y, al ser dependencia del efecto de re-sincronización, podría
// provocar un bucle infinito de renders si un caller omitiera estas props.
const EMPTY_FLAGS: FlagsMap = {};
const EMPTY_CROSS_ZONE_MAP: CrossZoneMap = {};
const EMPTY_REGULATIONS: RegulationRule[] = [];
const EMPTY_CONFIRMED_IDS: string[] = [];
const EMPTY_BUSY_MAP: RefereeBusyMap = {};
const EMPTY_PAID_REFEREE_IDS: string[] = [];

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
  /** Jueces ya asignados en otro campeonato que solapa fechas con este. */
  refereeBusyMap?: RefereeBusyMap;
  /** Resolución de la última propuesta, para explicar un rechazo. */
  lastReview?: RosterLastReview;
  /** Jueces con la liquidación pagada: su puesto no se puede sustituir. */
  paidRefereeIds?: string[];
  defaultZonaFilter?: string;
  /** Convocatoria viva del campeonato y sus inscripciones. */
  initialConvocatoria?: ConvocatoriaStaffView | null;
  /** Respuesta de cada juez designado (confirma / no puede ir). */
  respuestas?: Readonly<Record<string, DesignacionRespuesta>>;
  /** Gestión nacional (abre convocatorias a otras zonas sin esperar a su delegado). */
  isNationalUser?: boolean;
}

export function RosterBuilder({
  competition,
  template: initialTemplate,
  initialAssignments,
  initialFlags = EMPTY_FLAGS,
  initialCrossZoneMap = EMPTY_CROSS_ZONE_MAP,
  canEdit = false,
  canManageCompensation = false,
  isPast = false,
  referees,
  zones,
  levels,
  regulations = EMPTY_REGULATIONS,
  initialConfirmedIds = EMPTY_CONFIRMED_IDS,
  refereeBusyMap = EMPTY_BUSY_MAP,
  lastReview,
  paidRefereeIds = EMPTY_PAID_REFEREE_IDS,
  defaultZonaFilter = "TODAS",
  initialConvocatoria = null,
  respuestas = EMPTY_RESPUESTAS,
  isNationalUser = false,
}: RosterBuilderProps) {
  const router = useRouter();
  const readOnly = !canEdit;
  const [aprobacion, setAprobacion] = useState(competition.aprobacion);
  const approvalLocked = isRosterLockedByApproval(aprobacion);
  // Con propuesta pendiente la tarima también es de solo lectura: lo que se
  // apruebe tiene que ser exactamente lo que se envió.
  const rosterReadOnly = readOnly || isRosterFrozen(aprobacion);
  const [template, setTemplate] = useState(initialTemplate);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [flags, setFlags] = useState<FlagsMap>(initialFlags);
  const [crossZoneMap, setCrossZoneMap] = useState<CrossZoneMap>(initialCrossZoneMap);
  const paidRefereeIdSet = useMemo(() => new Set(paidRefereeIds), [paidRefereeIds]);
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
  const [convocatoria, setConvocatoria] = useState<ConvocatoriaStaffView | null>(initialConvocatoria);
  // Un juez que se apunta desde el portal llega con el refresco en tiempo real.
  useEffect(() => setConvocatoria(initialConvocatoria), [initialConvocatoria]);
  const [convocatoriaOpen, setConvocatoriaOpen] = useState(false);
  const [filterOnlyInscritos, setFilterOnlyInscritos] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [editCompetitionOpen, setEditCompetitionOpen] = useState(false);
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(initialTemplate[0]?.sesion ?? null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  // Entra al paso REAL según el progreso: sin plantilla → "plantilla"; tarima
  // completa → "revisión"; si tiene plantilla pero faltan huecos → "asignación".
  const [workflowStep, setWorkflowStep] = useState<RosterWorkflowStep>(() => {
    // Sin plantilla, `computeRosterCoverage` cae al fallback `requeridos` de la
    // competición (p. ej. 12) y nunca da 0: hay que mirar los huecos REALES.
    if (countRequiredSlots(initialTemplate) === 0) return "plantilla";
    const c = computeRosterCoverage(initialTemplate, initialAssignments, competition.requeridos);
    if (c.pct >= 100) return "revision";
    return "asignacion";
  });

  useEffect(() => {
    setAprobacion(competition.aprobacion);
  }, [competition.aprobacion]);

  const coverage = useMemo(
    () => computeRosterCoverage(template, assignments, competition.requeridos),
    [template, assignments, competition.requeridos],
  );
  const { requeridos: totalSlots, confirmados: filledSlots, openSlots, pct: fillPct } = coverage;
  // Huecos definidos por la plantilla (sin el fallback de `requeridos`).
  const templateSlots = useMemo(() => countRequiredSlots(template), [template]);
  const plantillaDone = templateSlots > 0;
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

  // Los guardas viven en refs a propósito: como dependencias, al terminar una
  // transición `pending` pasaba a false y el efecto se volvía a ejecutar
  // reescribiendo el estado recién guardado con las props del último render del
  // servidor, que aún son las anteriores (el refresh va con 800 ms de retardo).
  // El resultado era ver reaparecer el juez que acababas de quitar. Ahora el
  // efecto solo corre cuando cambian de verdad los datos del servidor.
  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  // Si llega un cambio del servidor mientras se edita o hay una operación en
  // curso, se aparta; al terminar se piden los datos actuales (ver abajo).
  // Antes simplemente se perdía: al cancelar la edición, la tarima seguía sin
  // las asignaciones que otro delegado había hecho entretanto.
  const skippedServerUpdateRef = useRef(false);

  useEffect(() => {
    if (isEditingRef.current || pendingRef.current) {
      skippedServerUpdateRef.current = true;
      return;
    }
    skippedServerUpdateRef.current = false;
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
  ]);

  useEffect(() => {
    if (isEditing || pending || !skippedServerUpdateRef.current) return;
    skippedServerUpdateRef.current = false;
    // No se aplica la instantánea apartada (puede ser anterior a lo que este
    // usuario acaba de guardar): se pide la actual.
    refreshCompetitionList();
  }, [isEditing, pending, refreshCompetitionList]);

  const handleUnlockImprevisto = async () => {
    const pendingApproval = isRosterPendingApproval(aprobacion);
    const ok = await confirmar(
      pendingApproval
        ? {
            titulo: "¿Retirar la propuesta y volver a editar la tarima?",
            detalle: "Saldrá de la bandeja de aprobación y tendrás que enviarla de nuevo cuando termines.",
            accion: "Retirar y editar",
          }
        : {
            titulo: "¿Registrar un imprevisto y desbloquear la tarima?",
            detalle: "Deberás volver a enviar la propuesta a aprobación cuando termines.",
            accion: "Registrar imprevisto",
          },
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        const res = await api.unlockRosterImprevisto(competition.id);
        setAprobacion(res.aprobacion);
        setStatusMsg(res.message);
        setStatusIsError(false);
        refreshCompetitionList();
      } catch (err) {
        setStatusMsg(
          formatApiError(
            err,
            pendingApproval ? "No se pudo retirar la propuesta" : "No se pudo registrar el imprevisto",
          ),
        );
        setStatusIsError(true);
      }
    });
  };

  useEffect(() => { if (templateSlots === 0) setWorkflowStep("plantilla"); }, [templateSlots]);

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

  // Designados que avisaron de que no pueden ir (y siguen en la tarima).
  const rechazos = useMemo(() => {
    const enTarima = new Set(Object.values(assignments).filter(Boolean));
    return Object.entries(respuestas).filter(([id, r]) => r.estado === "rechazada" && enTarima.has(id));
  }, [assignments, respuestas]);

  // Inscritos en la convocatoria para la sesión que se está montando: la del
  // hueco elegido o, sin hueco, la sesión activa.
  const signupSessionKey = (selectedSlot ? parseSlotKey(selectedSlot)?.session : undefined) ?? activeSessionKey;
  const inscritos = useMemo(() => {
    if (!convocatoria || !signupSessionKey || !convocatoria.convocatoria.sesiones.includes(signupSessionKey)) return null;
    const session = template.find((s) => s.sesion === signupSessionKey);
    return {
      ids: new Set(convocatoria.inscripciones.filter((i) => i.sesion === signupSessionKey).map((i) => i.refereeId)),
      sessionLabel: session?.nombre || signupSessionKey,
    };
  }, [convocatoria, signupSessionKey, template]);

  const availableReferees = useMemo(() => referees.filter((r) => {
    if (r.estado !== "Activo" || !r.disp) return false;
    if (filterOnlyConfirmed && !confirmedIds.has(r.id)) return false;
    if (filterOnlyInscritos && inscritos && !inscritos.ids.has(r.id)) return false;
    // Selección rápida = solo disponibles: al elegir un hueco, si hay
    // disponibilidad confirmada para la competición, se ocultan los no
    // confirmados (la selección rápida va DESPUÉS del paso de disponibilidad).
    if (selectedSlot && confirmedIds.size > 0 && !confirmedIds.has(r.id)) return false;
    if (filterZona !== "TODAS" && !zonesMatch(r.zona, filterZona)) return false;
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
  }), [assignments, competition.tipo, confirmedIds, filterNivel, filterOnlyConfirmed, filterOnlyInscritos, inscritos, filterZona, flags, referees, regulations, deferredSearch, selectedRoleKey, selectedSlot, template]);

  const hiddenUnavailableCount = useMemo(
    () => referees.filter((r) => r.estado !== "Activo" || !r.disp).length,
    [referees],
  );
  const clearRefereeFilters = useCallback(() => {
    setFilterZona("TODAS");
    setFilterNivel("TODOS");
    setSearch("");
    setFilterOnlyConfirmed(false);
    setFilterOnlyInscritos(false);
  }, []);

  // useCallback en persistAssign/persistClear/onDrop/onQuickAssign/toggleFlag:
  // son props de SessionBlock/RefereeCard (memoizados); si se recrearan en cada
  // render el memo no serviría de nada.
  const persistAssign = useCallback(async (slotKey: string, refereeId: string) => {
    const block = getOperationalBlock({ template, assignments, slotKey, refereeId, flags });
    let forceShared = false;
    if (block) {
      if (!block.overridable) { setStatusMsg(block.reason); setStatusIsError(true); return; }
      // Conflicto forzable: avisamos y, si se confirma, marcamos el puesto como
      // compartido (*) para dejar constancia en el acta y permitir el solape.
      const proceed = await confirmar({
        titulo: "¿Asignar de todas formas?",
        detalle: `${block.reason}\n\nEl puesto quedará marcado como compartido (*) en el cuadrante.`,
        accion: "Asignar como compartido",
      });
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
        // Se declara el ocupante que la pantalla tiene ahora: si otro usuario
        // tocó el hueco entretanto, el servidor responde 409 en vez de pisarlo.
        const res = await api.assignReferee(
          competition.id,
          slotKey,
          refereeId,
          flagPayload,
          undefined,
          snapshot[slotKey] ?? null,
        );
        setAssignments(res.assignments);
        if (res.flags) setFlags(res.flags);
        if (res.crossZoneMap) setCrossZoneMap(res.crossZoneMap);
        setStatusMsg(null); setStatusIsError(false);
        refreshCompetitionList();
      } catch (err) {
        setAssignments(snapshot); setFlags(flagsSnapshot); setSelectedSlot(slotKey);
        setStatusMsg(formatApiError(err, "No se pudo guardar la asignación")); setStatusIsError(true);
        // 409 = otro usuario tocó el hueco. Con el mensaje no basta: hay que
        // traer la tarima real, o el usuario sigue mirando la que ya no existe.
        if (err instanceof ApiRequestError && err.status === 409) refreshCompetitionList();
      }
    });
  }, [template, assignments, flags, competition.id, refreshCompetitionList, startTransition]);

  const persistClear = useCallback((slotKey: string) => {
    const snapshot = assignments;
    setAssignments((prev) => { const next = { ...prev }; delete next[slotKey]; return next; });
    startTransition(async () => {
      try { const res = await api.clearSlot(competition.id, slotKey, snapshot[slotKey] ?? null); setAssignments(res.assignments); setStatusMsg(null); setStatusIsError(false); refreshCompetitionList(); }
      catch (err) {
        setAssignments(snapshot);
        setStatusMsg(formatApiError(err, "No se pudo quitar la asignación"));
        setStatusIsError(true);
        if (err instanceof ApiRequestError && err.status === 409) refreshCompetitionList();
      }
    });
  }, [assignments, competition.id, refreshCompetitionList, startTransition]);

  const onDrop = useCallback((slotKey: string, refereeId: string) => {
    if (rosterReadOnly) return;
    void persistAssign(slotKey, refereeId);
    setDraggedId(null); setSelectedSlot(null);
  }, [rosterReadOnly, persistAssign]);

  const onQuickAssign = useCallback((refereeId: string) => {
    if (!selectedSlot || rosterReadOnly) return;
    void persistAssign(selectedSlot, refereeId);
  }, [selectedSlot, rosterReadOnly, persistAssign]);

  const onDragEnd = useCallback(() => setDraggedId(null), []);

  const onSelectSession = useCallback((sesion: string) => {
    setActiveSessionKey(sesion);
    setSelectedSlot(null);
  }, []);

  const toggleFlag = useCallback((slotKey: string, field: keyof SlotFlags) => {
    if (rosterReadOnly || !assignments[slotKey]) return;
    const next: SlotFlags = { ...(flags[slotKey] ?? {}), [field]: !(flags[slotKey]?.[field]) };
    const snapshot = flags;
    setFlags((prev) => ({ ...prev, [slotKey]: next }));
    startTransition(async () => {
      try { const res = await api.setSlotFlags(competition.id, slotKey, next); setFlags(res.flags); refreshCompetitionList(); }
      catch (err) { setFlags(snapshot); setStatusMsg(formatApiError(err, "No se pudieron guardar los marcadores del hueco")); setStatusIsError(true); }
    });
  }, [rosterReadOnly, assignments, flags, competition.id, refreshCompetitionList, startTransition]);

  const saveTemplate = (next: RosterSession[]) => {
    setSavingTemplate(true);
    // Mientras se edita no entran los cambios del servidor, así que `template`
    // sigue siendo la versión sobre la que se empezó a editar: su huella es la
    // que el servidor compara para no pisar a otra persona.
    const baseHash = rosterTemplateHash(template);
    startTransition(async () => {
      const aplicar = (res: Awaited<ReturnType<typeof api.saveTemplate>>) => {
        setTemplate(res.template); setAssignments(res.assignments); setFlags(res.flags);
        setIsEditing(false); setWorkflowStep("asignacion");
        setStatusMsg("Plantilla guardada"); setStatusIsError(false);
        refreshCompetitionList();
      };
      try {
        aplicar(await api.saveTemplate(competition.id, next, baseHash));
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 409) {
          const sobrescribir = await confirmar({
            titulo: "Otra persona ha cambiado la plantilla mientras la editabas",
            detalle: "Puedes guardar tu versión, que sustituye a la suya, o descartar tus cambios y cargar la versión actual.",
            accion: "Guardar la mía",
            cancelar: "Cargar la actual",
          });
          if (sobrescribir) {
            try {
              aplicar(await api.saveTemplate(competition.id, next));
            } catch (err2) {
              setStatusMsg(formatApiError(err2, "No se pudo guardar la plantilla")); setStatusIsError(true);
            }
          } else {
            setIsEditing(false);
            setStatusMsg("Se ha cargado la plantilla actual; tus cambios no se han guardado."); setStatusIsError(true);
            router.refresh();
          }
        } else {
          setStatusMsg(formatApiError(err, "No se pudo guardar la plantilla")); setStatusIsError(true);
        }
      }
      finally { setSavingTemplate(false); }
    });
  };

  const clearAllAssignments = async () => {
    if (rosterReadOnly || filledSlots === 0 || pending) return;
    const ok = await confirmar({
      titulo: `¿Vaciar todas las asignaciones de ${competition.nombre}?`,
      detalle: "La plantilla se mantiene; solo se liberan los huecos.",
      accion: "Vaciar asignaciones",
      peligro: true,
    });
    if (!ok) return;
    const sa = assignments; const sf = flags;
    setAssignments({}); setFlags({}); setSelectedSlot(null);
    startTransition(async () => {
      try { const res = await api.clearRosterAssignments(competition.id); setAssignments(res.assignments); setFlags(res.flags); setStatusMsg("Asignaciones borradas"); setStatusIsError(false); refreshCompetitionList(); }
      catch (err) { setAssignments(sa); setFlags(sf); setStatusMsg(formatApiError(err, "No se pudieron borrar las asignaciones")); setStatusIsError(true); }
    });
  };

  const clearTemplateAndAssignments = async () => {
    if (rosterReadOnly || template.length === 0 || pending || savingTemplate) return;
    const ok = await confirmar({
      titulo: `¿Borrar la plantilla de tarima de ${competition.nombre}?`,
      detalle: "Se eliminan sesiones, huecos y asignaciones. Podrás importar el horario de nuevo.",
      accion: "Borrar plantilla",
      peligro: true,
    });
    if (!ok) return;
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
      <div className="flex h-[calc(100dvh-var(--size-topbar))] flex-col">
        {/* Render condicional: así el chunk dynamic solo se descarga al abrir
            el diálogo, no al montar la ruta. */}
        {importOpen && (
          <ScheduleImportDialog
            competitionId={competition.id}
            open={importOpen}
            hasExistingTemplate={template.length > 0}
            onClose={() => setImportOpen(false)}
            onApplied={(tpl) => { setTemplate(tpl); setImportOpen(false); setWorkflowStep("asignacion"); setStatusMsg("Plantilla importada desde PDF"); setStatusIsError(false); }}
          />
        )}
        {quadrantImportOpen && (
          <QuadrantImportDialog
            competitionId={competition.id}
            open={quadrantImportOpen}
            onClose={() => setQuadrantImportOpen(false)}
            onApplied={(nextAssignments, nextFlags) => { setAssignments(nextAssignments); if (nextFlags) setFlags(nextFlags); setQuadrantImportOpen(false); setWorkflowStep("asignacion"); setStatusMsg("Cuadrante aplicado"); setStatusIsError(false); }}
          />
        )}
        <RosterCompetitionHeader
          competition={{ ...competition, aprobacion }}
          isPast={isPast} canEdit={canEdit}
          canManageCompensation={canManageCompensation}
          rosterLocked={approvalLocked}
          submitBlockedReason={
            templateSlots === 0
              ? "Define primero la plantilla de la tarima"
              : filledSlots === 0
                ? "Asigna al menos un juez antes de enviar"
                : null
          }
          violationCount={violationCount} filledSlots={filledSlots} totalSlots={totalSlots}
          fillPct={fillPct} openSlots={openSlots} pending={pending} savingTemplate={savingTemplate}
          isEditing={isEditing} statusMsg={statusMsg} statusIsError={statusIsError}
          templateLength={template.length}
          onOpenEdit={() => setEditCompetitionOpen(true)}
          convocatoria={
            convocatoria
              ? {
                  abierta: isConvocatoriaAbierta(convocatoria.convocatoria),
                  inscritos: new Set(convocatoria.inscripciones.map((i) => i.refereeId)).size,
                }
              : null
          }
          onOpenConvocatoria={canEdit && !isPast && template.length > 0 ? () => setConvocatoriaOpen(true) : undefined}
          onOpenImport={() => setImportOpen(true)}
          onOpenQuadrant={() => setQuadrantImportOpen(true)}
          clearAllAssignments={clearAllAssignments}
          clearTemplateAndAssignments={clearTemplateAndAssignments}
          onStatus={(msg, isError) => { setStatusMsg(msg); setStatusIsError(isError ?? false); }}
          startTransition={startTransition}
          onToggleEditing={() => {
            if (isEditing) { setIsEditing(false); setWorkflowStep(templateSlots > 0 ? "asignacion" : "plantilla"); }
            else { setIsEditing(true); setWorkflowStep("plantilla"); }
          }}
        />
        <RosterImprevistoBanner
          aprobacion={aprobacion}
          canEdit={canEdit}
          pending={pending}
          lastReview={lastReview}
          onUnlock={handleUnlockImprevisto}
        />
        {rechazos.length > 0 && (
          // Un juez designado avisó desde su portal de que no puede ir. La
          // tarima aprobada se abre en «Revisión», donde la marca del hueco no
          // se ve: sin esto, el delegado se enteraba por la campana o no se
          // enteraba.
          <div role="status" className="flex flex-wrap items-start gap-2 border-b border-destructive/20 bg-destructive-muted px-4 py-2.5 text-xs sm:px-5 lg:px-6">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
            <p className="min-w-0 max-w-prose flex-1 text-foreground">
              {rechazos.map(([id, r], i) => (
                <span key={id}>
                  {i > 0 && " · "}
                  <strong className="font-semibold">{refereeById.get(id)?.nombre ?? id}</strong> no puede ir
                  {r.motivo ? ` («${r.motivo}»)` : ""}
                </span>
              ))}
              . {approvalLocked ? "Registra un imprevisto para sustituirle." : "Cambia su puesto antes de enviar la tarima."}
            </p>
          </div>
        )}
        {!readOnly && (
          <>
            <RosterHelpPanel>
            <RosterStepper
              current={isEditing ? "plantilla" : workflowStep}
              onChange={(step) => {
                setWorkflowStep(step);
                // "Plantilla" = trabajar la ESTRUCTURA. Si ya existe plantilla, abre el
                // editor de sesiones directamente; antes mostraba la tarima en solo
                // lectura (lo mismo que Asignación sin el panel de jueces), que no aporta.
                setIsEditing(step === "plantilla" && templateSlots > 0);
              }}
              disabled={pending || savingTemplate}
              plantillaDone={plantillaDone}
              asignacionDone={asignacionDone}
            />
            </RosterHelpPanel>
          </>
        )}
        {workflowStep === "revision" && !isEditing && !readOnly ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <RosterRevisionPanel competitionId={competition.id} filledSlots={filledSlots} totalSlots={totalSlots} fillPct={fillPct} violationCount={violationCount} openSlots={openSlots} onGoAssign={() => setWorkflowStep("asignacion")} />
          </div>
        ) : workflowStep === "plantilla" && !isEditing && templateSlots === 0 ? (
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
            <p className="text-xs text-subtle-muted">El calendario anual (varios campeonatos) se importa desde la lista de Campeonatos.</p>
          </div>
        ) : (
          <div
            className={cn(
              "grid min-h-0 flex-1 grid-cols-1",
              showRefereePanel &&
                "md:grid-cols-(--grid-tarima)",
            )}
          >
            {showRefereePanel && (
              <RosterRefereePanelLeft
                referees={availableReferees} assignedIds={activeSessionAssignedIds}
                canEdit={canEdit} readOnly={rosterReadOnly}
                selectedSlot={selectedSlot} selectedSlotMeta={selectedSlotMeta}
                confirmedIds={confirmedIds} busyElsewhere={refereeBusyMap} filterOnlyConfirmed={filterOnlyConfirmed}
                filterZona={filterZona} filterNivel={filterNivel} search={search}
                zones={zones} levels={levels} isDragging={isDragging} draggedId={draggedId}
                competitionTipo={competition.tipo} competitionZona={competition.zona}
                regulations={regulations} template={template} assignments={assignments} flags={flags}
                selectedRoleKey={selectedRoleKey}
                onSelectSlot={setSelectedSlot} onAvailabilityOpen={() => setAvailabilityOpen(true)}
                onFilterZona={setFilterZona} onFilterNivel={setFilterNivel}
                onSearch={setSearch} onFilterConfirmed={setFilterOnlyConfirmed}
                inscritos={inscritos} filterOnlyInscritos={filterOnlyInscritos} onFilterInscritos={setFilterOnlyInscritos}
                onDragStart={setDraggedId} onDragEnd={onDragEnd}
                onQuickAssign={onQuickAssign}
                hiddenUnavailableCount={hiddenUnavailableCount}
                onClearFilters={clearRefereeFilters}
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
                          {/* Rótulo de día en tono neutro: el rojo queda para la
                              sesión activa y la acción principal. */}
                          <span className="shrink-0 text-2xs font-semibold text-foreground-secondary">
                            {dia}
                          </span>
                          {sesiones.map((session) => (
                            <SessionTab
                              key={session.sesion}
                              session={session}
                              assignments={assignments}
                              active={activeSession?.sesion === session.sesion}
                              onClick={onSelectSession}
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
                            <div className="rounded-xl border border-border-muted bg-surface/25 p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-subtle-muted">Huecos pendientes</p>
                                <span className="text-2xs text-subtle-muted">{activeSessionPendingSlots.length} sin cubrir</span>
                              </div>
                              {activeSessionPendingSlots.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {activeSessionPendingSlots.map((slot) => (
                                    <button
                                      key={slot.slotKey} type="button" onClick={() => setSelectedSlot(slot.slotKey)}
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-2xs transition-colors focus-ring",
                                        selectedSlot === slot.slotKey ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-border-strong hover:bg-surface",
                                      )}
                                    >
                                      <span>{slot.sessionLabel}</span>
                                      <ChevronRight className="h-3 w-3" />
                                      <span>{slot.roleLabel}</span>
                                      <span>{slot.slotNumber}</span>
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
                            paidRefereeIds={paidRefereeIdSet}
                            respuestas={respuestas}
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
      {/* Montaje condicional: descarga el chunk solo al abrir y garantiza que el
          formulario se inicialice con los datos vigentes de la competición en
          cada apertura (sin valores "fantasma" de una edición cancelada). */}
      {editCompetitionOpen && (
        <EditCompetitionDialog competition={competition} zones={zones} open={editCompetitionOpen} onClose={() => setEditCompetitionOpen(false)} />
      )}
      {convocatoriaOpen && (
        <ConvocatoriaDialog
          open
          onClose={() => setConvocatoriaOpen(false)}
          competition={competition}
          template={template}
          referees={referees}
          view={convocatoria}
          onChange={setConvocatoria}
          isNational={isNationalUser}
        />
      )}
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
