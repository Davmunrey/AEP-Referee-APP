import {
  ACTIVITY,
  CALENDAR_EVENTS,
  COMPETITIONS,
  INITIAL_ASSIGNMENTS,
  LEVELS,
  REFEREES,
  ROSTER_TEMPLATE,
  ZONES,
} from "@/lib/mock-data";
import type {
  ActivityItem,
  ApprovalProposal,
  AssignmentsMap,
  Competition,
  PromotionRequest,
  Referee,
  RegulationRule,
  RosterHistoryEntry,
} from "@/lib/types";

interface AppStore {
  referees: Referee[];
  competitions: Competition[];
  assignments: Map<string, AssignmentsMap>;
  approvals: ApprovalProposal[];
  promotions: PromotionRequest[];
  activity: ActivityItem[];
  history: RosterHistoryEntry[];
}

const globalStore = globalThis as unknown as { __aepStore?: AppStore };

function seedApprovals(): ApprovalProposal[] {
  return [
    {
      id: "apr-001",
      eventId: "evt-003",
      eventName: "Open Internacional Cataluña",
      zona: "CAT",
      submittedBy: "Resp. Cataluña",
      submittedAt: "2026-05-14T10:30:00Z",
      status: "pendiente",
      assignments: {
        S1_jurado_0: "j002",
        S1_central_0: "j007",
        S1_lateral_0: "j006",
      },
    },
    {
      id: "apr-002",
      eventId: "evt-001",
      eventName: "Cto. de España Junior y Sub-23",
      zona: "MAD",
      submittedBy: "Resp. Madrid",
      submittedAt: "2026-05-13T16:00:00Z",
      status: "pendiente",
      assignments: { ...INITIAL_ASSIGNMENTS },
    },
    {
      id: "apr-003",
      eventId: "evt-004",
      eventName: "Cto. Regional País Vasco",
      zona: "PVA",
      submittedBy: "Resp. P. Vasco",
      submittedAt: "2026-05-12T09:15:00Z",
      status: "pendiente",
      assignments: {
        S1_jurado_0: "j007",
        S1_central_0: "j013",
      },
    },
  ];
}

function seedPromotions(): PromotionRequest[] {
  return [
    {
      id: "pro-001",
      refereeId: "j002",
      refereeName: "Marta Ruiz",
      fromLevel: "IPF Cat. 2",
      toLevel: "IPF Cat. 1",
      zona: "CAT",
      status: "pendiente",
      submittedAt: "2026-05-10",
      eventosCompletados: 6,
      motivo: "6 eventos AEP-2 como central en 2025-26",
    },
    {
      id: "pro-002",
      refereeId: "j006",
      refereeName: "Sara Domínguez",
      fromLevel: "Regional",
      toLevel: "Nacional",
      zona: "CAT",
      status: "pendiente",
      submittedAt: "2026-05-08",
      eventosCompletados: 2,
    },
    {
      id: "pro-003",
      refereeId: "j010",
      refereeName: "Cristina Soto",
      fromLevel: "IPF Cat. 2",
      toLevel: "IPF Cat. 1",
      zona: "MAD",
      status: "aprobado",
      submittedAt: "2026-04-20",
      eventosCompletados: 6,
    },
  ];
}

export const REGULATION_RULES: RegulationRule[] = [
  {
    id: "reg-1",
    rol: "Juez Central",
    roleKey: "central",
    minLevel: "IPF Cat. 2",
    eventTypes: ["AEP-1"],
    note: "AEP-1 exige mínimo IPF Cat. 2 en central y laterales",
  },
  {
    id: "reg-2",
    rol: "Juez Central",
    roleKey: "central",
    minLevel: "Nacional",
    eventTypes: ["AEP-2", "AEP-3"],
    note: "Campeonatos regionales/nacionales",
  },
  {
    id: "reg-3",
    rol: "Jurado",
    roleKey: "jurado",
    minLevel: "Nacional",
    eventTypes: ["AEP-1"],
    note: "Mínimo Nacional en AEP-1",
  },
  {
    id: "reg-4",
    rol: "Pesaje / Material",
    roleKey: "pesaje",
    minLevel: "Regional",
    eventTypes: ["AEP-1", "AEP-2", "AEP-3"],
    note: "Regional o superior",
  },
];

function createStore(): AppStore {
  const assignments = new Map<string, AssignmentsMap>();
  assignments.set("evt-001", { ...INITIAL_ASSIGNMENTS });
  return {
    referees: REFEREES.map((r) => ({ ...r })),
    competitions: COMPETITIONS.map((c) => ({ ...c })),
    assignments,
    approvals: seedApprovals(),
    promotions: seedPromotions(),
    activity: [...ACTIVITY],
    history: [],
  };
}

export function getStore(): AppStore {
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
  return ROSTER_TEMPLATE;
}

export function getCalendarEvents() {
  return CALENDAR_EVENTS;
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
