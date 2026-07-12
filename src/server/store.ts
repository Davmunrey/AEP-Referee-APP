import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LEVELS, PRESET_AEP1, ZONES } from "@/lib/mock-data";
import { calendarEventsFromCompetitions } from "@/lib/calendar-from-competitions";
import { normalizeCompetitionTemplate } from "@/lib/roster-template";
import type {
  ActivityItem,
  ApprovalProposal,
  AssignmentsMap,
  Competition,
  FlagsMap,
  PromotionRequest,
  Referee,
  RefereeExam,
  RefereeReport,
  RefereeSanction,
  RegulationRule,
  RosterHistoryEntry,
  RosterSession,
} from "@/lib/types";

interface AppStore {
  referees: Referee[];
  competitions: Competition[];
  templates: Map<string, RosterSession[]>;
  assignments: Map<string, AssignmentsMap>;
  slotFlags: Map<string, FlagsMap>;
  approvals: ApprovalProposal[];
  promotions: PromotionRequest[];
  activity: ActivityItem[];
  history: RosterHistoryEntry[];
  exams: RefereeExam[];
  reports: RefereeReport[];
  sanctions: RefereeSanction[];
}

const globalStore = globalThis as unknown as { __aepStore?: AppStore };

function createStore(): AppStore {
  return {
    referees: [],
    competitions: [],
    templates: new Map(),
    assignments: new Map(),
    slotFlags: new Map(),
    approvals: [],
    promotions: [],
    activity: [],
    history: [],
    exams: [],
    reports: [],
    sanctions: [],
  };
}

export function getStore(): AppStore {
  if (isSupabaseConfigured()) {
    throw new Error("getStore() no debe usarse con Supabase activo — usa supabaseDataService");
  }
  if (!globalStore.__aepStore) {
    globalStore.__aepStore = createStore();
  }
  return globalStore.__aepStore;
}

export function getZones() {
  return ZONES;
}

export function getLevels() {
  return LEVELS;
}

export function getRosterTemplate() {
  return PRESET_AEP1;
}

export function getCompetitionTemplate(competitionId: string): RosterSession[] {
  const store = getStore();
  const existing = store.templates.get(competitionId);
  if (existing) return existing;
  const comp = store.competitions.find((c) => c.id === competitionId);
  const tpl = comp ? normalizeCompetitionTemplate([], comp.tipo) : [];
  store.templates.set(competitionId, tpl);
  return tpl;
}

export function setCompetitionTemplate(competitionId: string, template: RosterSession[]) {
  getStore().templates.set(competitionId, template);
}

export function getCalendarEvents(competitions?: Competition[]) {
  const list = competitions ?? getStore().competitions;
  return calendarEventsFromCompetitions(list);
}

let idSeq = 0;
/** Id único incluso dentro del mismo milisegundo (evita colisiones de `${prefijo}-${Date.now()}`). */
export function nextSeqId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${Date.now()}-${idSeq}`;
}

export function pushActivity(item: ActivityItem) {
  getStore().activity.unshift(item);
  if (getStore().activity.length > 20) getStore().activity.pop();
}

export function pushHistory(entry: Omit<RosterHistoryEntry, "id">) {
  const store = getStore();
  store.history.unshift({
    ...entry,
    id: `hist-${Date.now()}-${store.history.length}`,
  });
}

export const REGULATION_RULES: RegulationRule[] = [
  {
    id: "reg-01",
    rol: "Juez Central",
    roleKey: "central",
    minLevel: "Nacional",
    eventTypes: ["AEP-1", "AEP-2", "AEP-3"],
    note: "Mínimo Nacional en AEP-1; IPF Cat. 2 en AEP-2/3 según guía.",
  },
  {
    id: "reg-02",
    rol: "Juez Lateral",
    roleKey: "lateral",
    minLevel: "Nacional",
    eventTypes: ["AEP-1", "AEP-2", "AEP-3"],
    note: "",
  },
  {
    id: "reg-03",
    rol: "Jurado",
    roleKey: "jurado",
    minLevel: "IPF Cat. 2",
    eventTypes: ["AEP-1"],
    note: "Solo AEP-1 (3 plazas).",
  },
  {
    id: "reg-04",
    rol: "Ordenador",
    roleKey: "ordenador",
    minLevel: "Regional",
    eventTypes: ["AEP-1", "AEP-2", "AEP-3"],
    note: "",
  },
  {
    id: "reg-05",
    rol: "Speaker / Mesa",
    roleKey: "speaker",
    minLevel: "Regional",
    eventTypes: ["AEP-1", "AEP-2", "AEP-3"],
    note: "",
  },
  {
    id: "reg-06",
    rol: "Juez Control",
    roleKey: "control",
    minLevel: "Regional",
    eventTypes: ["AEP-1", "AEP-2", "AEP-3"],
    note: "",
  },
  {
    id: "reg-07",
    rol: "Pesaje",
    roleKey: "pesaje",
    minLevel: "Regional",
    eventTypes: ["AEP-1", "AEP-2", "AEP-3"],
    note: "",
  },
  {
    id: "reg-08",
    rol: "Control Equipamiento",
    roleKey: "equipamiento",
    minLevel: "Regional",
    eventTypes: ["AEP-1", "AEP-2", "AEP-3"],
    note: "",
  },
  {
    id: "reg-09",
    rol: "Liftingcast / OpenLifter",
    roleKey: "liftingcast",
    minLevel: "Regional",
    eventTypes: ["AEP-2", "AEP-3"],
    note: "",
  },
  {
    id: "reg-10",
    rol: "Mesa",
    roleKey: "mesa",
    minLevel: "Regional",
    eventTypes: ["AEP-2", "AEP-3"],
    note: "",
  },
  {
    id: "reg-11",
    rol: "Juez Central (AEP-3)",
    roleKey: "central",
    minLevel: "Nacional",
    eventTypes: ["AEP-3"],
    note: "Regional permitido en regionales según delegación.",
  },
];
