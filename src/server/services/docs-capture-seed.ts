import { PRESET_AEP2 } from "@/lib/mock-data";
import type { AssignmentsMap, Competition, Referee } from "@/lib/types";
import { isDocsCaptureMode } from "@/lib/auth/docs-capture";
import { getStore, setCompetitionTemplate } from "@/server/store";

export const DOCS_CAPTURE_COMPETITION_ID = "evt-docs-001";

let seeded = false;

const REFEREES: Referee[] = [
  {
    id: "j001",
    nombre: "Ana Roa Sales",
    zona: "LEV",
    nivel: "Nacional",
    estado: "Activo",
    eventos: 24,
    ultimo: "Open Cantabria 2026",
    disp: true,
    iniciales: "AR",
    email: "ana.roa@example.test",
    localidad: "Murcia",
  },
  {
    id: "j002",
    nombre: "Javier Ruiz García",
    zona: "NOR",
    nivel: "IPF Cat. 2",
    estado: "Activo",
    eventos: 18,
    ultimo: "Copa Madrid 2026",
    disp: true,
    iniciales: "JR",
    email: "javier.ruiz@example.test",
    localidad: "Santander",
  },
  {
    id: "j003",
    nombre: "María López Prieto",
    zona: "CEN",
    nivel: "Nacional",
    estado: "Activo",
    eventos: 31,
    ultimo: "AEP-3 Valencia",
    disp: false,
    iniciales: "ML",
    email: "maria.lopez@example.test",
    localidad: "Madrid",
  },
  {
    id: "j004",
    nombre: "Carlos Méndez Ortiz",
    zona: "SUR",
    nivel: "Regional",
    estado: "Activo",
    eventos: 9,
    ultimo: "Regional Málaga",
    disp: true,
    iniciales: "CM",
    email: "carlos.mendez@example.test",
    localidad: "Málaga",
  },
  {
    id: "j005",
    nombre: "Elena Torres Vega",
    zona: "CAT",
    nivel: "IPF Cat. 2",
    estado: "Activo",
    eventos: 15,
    ultimo: "Open Cataluña",
    disp: true,
    iniciales: "ET",
    email: "elena.torres@example.test",
    localidad: "Barcelona",
  },
];

const COMPETITION: Competition = {
  id: DOCS_CAPTURE_COMPETITION_ID,
  nombre: "Open Powerlifting Cantabria 2026",
  tipo: "AEP-2",
  fecha: "2026-04-12",
  fechaFin: "2026-04-13",
  sede: "Polideportivo La Albericia, Santander",
  sesiones: 3,
  requeridos: 9,
  confirmados: 5,
  estado: "Incompleto",
  aprobacion: "Sin propuesta",
  zona: "NOR",
  compensationOrganizer: "club",
  compensationClubName: "Cantabria Powerlifting Club",
  compensationClubEmail: "cantabriaplc@gmail.com",
  compensationClubs: [{ name: "Cantabria Powerlifting Club", emails: ["cantabriaplc@gmail.com"] }],
};

// Las claves de hueco son `${sesion}_${rol}_${índice}` con el índice desde 0
// (ver `enumerateSlotKeys`). La semilla usaba `S1:central:1`, que no casa con
// ninguna: la tarima de demostración salía vacía —0 de 45— en las capturas del
// manual y en el arranque local sin Supabase, con las 15 asignaciones ahí
// guardadas sin que nada pudiera leerlas.
const ASSIGNMENTS: AssignmentsMap = {
  S1_central_0: "j002",
  S1_lateral_0: "j003",
  S1_lateral_1: "j004",
  S1_ordenador_0: "j001",
  S1_speaker_0: "j005",
  S1_control_0: "j003",
  S1_pesaje_0: "j004",
  S1_equipamiento_0: "j001",
  S2_central_0: "j001",
  S2_lateral_0: "j002",
  S2_lateral_1: "j005",
  S2_ordenador_0: "j003",
  S2_speaker_0: "j004",
  S2_control_0: "j002",
  S2_pesaje_0: "j001",
};

/** Datos mínimos para capturas del manual (solo modo AEP_DOCS_CAPTURE). */
export function ensureDocsCaptureSeed(): void {
  if (!isDocsCaptureMode()) return;
  if (seeded) return;

  const store = getStore();
  if (store.competitions.some((c) => c.id === DOCS_CAPTURE_COMPETITION_ID)) {
    seeded = true;
    return;
  }

  store.referees.push(...REFEREES.map((r) => ({ ...r })));

  store.competitions.push({ ...COMPETITION });
  setCompetitionTemplate(DOCS_CAPTURE_COMPETITION_ID, PRESET_AEP2.map((s) => ({ ...s, roles: s.roles.map((r) => ({ ...r })), pesajeRoles: s.pesajeRoles.map((r) => ({ ...r })) })));
  store.assignments.set(DOCS_CAPTURE_COMPETITION_ID, { ...ASSIGNMENTS });
  store.slotFlags.set(DOCS_CAPTURE_COMPETITION_ID, {});

  store.competitions.push({
    id: "evt-docs-002",
    nombre: "Copa Madrid AEP-3 2026",
    tipo: "AEP-3",
    fecha: "2026-05-03",
    fechaFin: "2026-05-03",
    sede: "Madrid",
    sesiones: 2,
    requeridos: 6,
    confirmados: 4,
    estado: "Borrador",
    aprobacion: "Sin propuesta",
    zona: "CEN",
  });

  store.approvals.push({
    id: "apr-docs-1",
    competitionId: "evt-docs-002",
    competitionName: "Copa Madrid AEP-3 2026",
    zona: "CEN",
    status: "pendiente",
    submittedBy: "Delegado Centro",
    submittedAt: "2026-03-20T10:00:00Z",
    assignments: {},
  });

  seeded = true;
}
