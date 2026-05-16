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
  RefereeExam,
  RefereeReport,
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
  exams: RefereeExam[];
  reports: RefereeReport[];
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
  // ─── Juez Central ──────────────────────────────────────────────────────────
  {
    id: "reg-c1",
    rol: "Juez Central",
    roleKey: "central",
    minLevel: "IPF Cat. 1",
    eventTypes: ["AEP-1"],
    note: "Campeonato de España: el central debe ser IPF Cat. 1 para homologación mundial (IPF TR Art. 3.5.1)",
  },
  {
    id: "reg-c2",
    rol: "Juez Central",
    roleKey: "central",
    minLevel: "IPF Cat. 2",
    eventTypes: ["AEP-2"],
    note: "Campeonato nacional abierto: central mínimo IPF Cat. 2 (AEP Reglamento Art. 8.2)",
  },
  {
    id: "reg-c3",
    rol: "Juez Central",
    roleKey: "central",
    minLevel: "Nacional",
    eventTypes: ["AEP-3"],
    note: "Campeonato regional: central mínimo Nacional (AEP Reglamento Art. 8.3)",
  },
  // ─── Jueces Laterales ──────────────────────────────────────────────────────
  {
    id: "reg-l1",
    rol: "Juez Lateral",
    roleKey: "lateral",
    minLevel: "IPF Cat. 2",
    eventTypes: ["AEP-1"],
    note: "AEP-1: laterales mínimo IPF Cat. 2 (IPF TR Art. 3.5.2). Se requieren 2 laterales por plataforma.",
  },
  {
    id: "reg-l2",
    rol: "Juez Lateral",
    roleKey: "lateral",
    minLevel: "Nacional",
    eventTypes: ["AEP-2"],
    note: "AEP-2: laterales mínimo Nacional (AEP Reglamento Art. 8.2). 2 laterales por plataforma.",
  },
  {
    id: "reg-l3",
    rol: "Juez Lateral",
    roleKey: "lateral",
    minLevel: "Regional",
    eventTypes: ["AEP-3"],
    note: "AEP-3: laterales mínimo Regional (AEP Reglamento Art. 8.3).",
  },
  // ─── Jurado ────────────────────────────────────────────────────────────────
  {
    id: "reg-j1",
    rol: "Jurado",
    roleKey: "jurado",
    minLevel: "IPF Cat. 1",
    eventTypes: ["AEP-1"],
    note: "Campeonato de España: jurado mínimo IPF Cat. 1. Resuelve apelaciones por mayoría simple (IPF TR Art. 3.6)",
  },
  {
    id: "reg-j2",
    rol: "Jurado",
    roleKey: "jurado",
    minLevel: "IPF Cat. 2",
    eventTypes: ["AEP-2"],
    note: "AEP-2: jurado mínimo IPF Cat. 2 (AEP Reglamento Art. 9.1).",
  },
  {
    id: "reg-j3",
    rol: "Jurado",
    roleKey: "jurado",
    minLevel: "Nacional",
    eventTypes: ["AEP-3"],
    note: "AEP-3: jurado mínimo Nacional (AEP Reglamento Art. 9.2).",
  },
  // ─── Pesaje ────────────────────────────────────────────────────────────────
  {
    id: "reg-p1",
    rol: "Pesaje",
    roleKey: "pesaje",
    minLevel: "Nacional",
    eventTypes: ["AEP-1", "AEP-2"],
    note: "Campeonatos nacionales: responsable de pesaje mínimo Nacional (IPF TR Art. 4.1.1).",
  },
  {
    id: "reg-p2",
    rol: "Pesaje",
    roleKey: "pesaje",
    minLevel: "Regional",
    eventTypes: ["AEP-3"],
    note: "Campeonato regional: pesaje mínimo Regional (AEP Reglamento Art. 10).",
  },
  // ─── Control de material ───────────────────────────────────────────────────
  {
    id: "reg-m1",
    rol: "Control de material",
    roleKey: "material",
    minLevel: "Regional",
    eventTypes: ["AEP-1", "AEP-2", "AEP-3"],
    note: "Control de equipamiento: mínimo Regional en todos los tipos de campeonato (IPF TR Art. 4.2).",
  },
];

function seedExams(): RefereeExam[] {
  const [a, b, c] = REFEREES;
  const rows: RefereeExam[] = [];
  if (a)
    rows.push({
      id: "exam-seed-1",
      refereeId: a.id,
      refereeName: a.nombre,
      tipo: "Reglamento IPF",
      nivelObjetivo: "Nacional",
      fecha: "2026-02-14",
      examinador: "Comité Técnico AEP",
      puntuacion: 88,
      puntuacionMaxima: 100,
      resultado: "Aprobado",
      notas: "Examen anual de reglamento técnico.",
    });
  if (b)
    rows.push({
      id: "exam-seed-2",
      refereeId: b.id,
      refereeName: b.nombre,
      tipo: "Práctico",
      nivelObjetivo: "IPF Cat. 2",
      fecha: "2026-04-03",
      examinador: "Comité Técnico IPF",
      puntuacionMaxima: 100,
      resultado: "Pendiente",
    });
  if (c)
    rows.push({
      id: "exam-seed-3",
      refereeId: c.id,
      refereeName: c.nombre,
      tipo: "Recertificación",
      nivelObjetivo: "Nacional",
      fecha: "2026-01-20",
      examinador: "Comité Técnico AEP",
      puntuacion: 58,
      puntuacionMaxima: 100,
      resultado: "Suspenso",
      notas: "Debe repetir la parte práctica.",
    });
  return rows;
}

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
    exams: seedExams(),
    reports: [],
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
