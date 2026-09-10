import { normalizeZoneInput, resolveZoneCode } from "@/lib/aep-zones";
import { zoneVisibilityFilter } from "@/lib/zone-scope";
import { computeJudgeProfile } from "@/lib/judge-stats";
import type {
  AppMeta,
  JudgeProfile,
  Referee,
  SessionUser,
} from "@/lib/types";
import {
  getLevels,
  getStore,
  getZones,
  pushActivity,
} from "@/server/store";
import {
  RefereeAssignedError,
  RefereePromotionsError,
  RefereeHasClaimsError,
} from "@/lib/competitions/service-types";
import { buildMemoryCompetitionHistory } from "./memory-helpers";

export async function getMeta(user: SessionUser): Promise<AppMeta> {
  return {
    zones: getZones(),
    levels: getLevels(),
    currentUser: user,
  };
}

export async function getReferees(params?: {
  zona?: string;
  nivel?: string;
  estado?: string;
  q?: string;
  user?: SessionUser;
}): Promise<Referee[]> {
  const store = getStore();
  // Normaliza las zonas igual que el backend de Supabase (resolveZoneCode), para
  // que el filtro por zona se comporte idéntico en dev y en producción.
  // Mismo corte que el twin de Supabase: `undefined` mezclaba «sin restricción»
  // con «delegado de zona cuya zona no se reconoce», y el segundo se quedaba sin
  // filtro y leía el censo entero.
  const visibleEnZona = zoneVisibilityFilter(params?.user);
  const filterZone =
    params?.zona && params.zona !== "TODAS"
      ? (resolveZoneCode(params.zona) ?? params.zona)
      : undefined;
  return store.referees.filter((r) => {
    const rZone = resolveZoneCode(r.zona) ?? r.zona;
    if (!visibleEnZona(r.zona)) return false;
    if (filterZone && rZone !== filterZone) return false;
    if (params?.nivel && params.nivel !== "TODOS" && r.nivel !== params.nivel) return false;
    if (params?.estado && params.estado !== "TODOS" && r.estado !== params.estado) return false;
    if (params?.q && !r.nombre.toLowerCase().includes(params.q.toLowerCase())) return false;
    return true;
  });
}

export async function getReferee(id: string) {
  return getStore().referees.find((r) => r.id === id);
}

/** Paridad con el twin de Supabase: fichas por lote, indexadas por id. */
export async function getRefereesByIds(ids: string[]): Promise<Map<string, Referee>> {
  const wanted = new Set(ids.filter(Boolean));
  const map = new Map<string, Referee>();
  if (wanted.size === 0) return map;
  for (const referee of getStore().referees) {
    if (wanted.has(referee.id)) map.set(referee.id, referee);
  }
  return map;
}

export async function createReferee(input: Omit<Referee, "id" | "iniciales">): Promise<Referee> {
  const store = getStore();
  // ID por máximo existente, no por longitud del array: tras borrar un juez
  // intermedio, `length + 1` reutilizaría un id ya usado.
  const maxNum = store.referees.reduce((max, r) => {
    const m = /^j(\d+)$/i.exec(r.id);
    const n = m ? parseInt(m[1], 10) : 0;
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  const id = `j${String(maxNum + 1).padStart(3, "0")}`;
  const iniciales = input.nombre
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const referee: Referee = {
    ...input,
    id,
    iniciales,
    zona: normalizeZoneInput(input.zona) ?? input.zona,
  };
  store.referees.push(referee);
  pushActivity({
    tipo: "cambio",
    actor: "Sistema",
    accion: "registró al juez",
    evento: referee.nombre,
    hace: "ahora",
  });
  return referee;
}

export async function updateReferee(id: string, patch: Partial<Referee>): Promise<Referee | undefined> {
  const store = getStore();
  const idx = store.referees.findIndex((r) => r.id === id);
  if (idx < 0) return undefined;
  const merged = {
    ...store.referees[idx]!,
    ...patch,
    ...(patch.zona !== undefined
      ? { zona: normalizeZoneInput(patch.zona) ?? patch.zona }
      : {}),
  };
  if (typeof patch.nombre === "string" && patch.nombre.trim()) {
    merged.iniciales = patch.nombre
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  store.referees[idx] = merged;
  return merged;
}

export async function deleteReferee(id: string): Promise<boolean> {
  const store = getStore();
  const idx = store.referees.findIndex((r) => r.id === id);
  if (idx < 0) return false;
  // Mismo corte que el twin de Supabase: la liquidación no se tira por borrar
  // una ficha (allí la clave ajena es ON DELETE CASCADE). El store de
  // compensación se lee por globalThis, igual que en deleteCompetition, para no
  // cerrar un ciclo de imports.
  const claimsStore = (
    globalThis as unknown as { __aepCompensationStore?: Map<string, { refereeId: string }> }
  ).__aepCompensationStore;
  if (claimsStore) {
    let claims = 0;
    for (const claim of claimsStore.values()) if (claim.refereeId === id) claims += 1;
    if (claims > 0) throw new RefereeHasClaimsError(claims);
  }
  // Ídem con la tarima: en producción la clave ajena de `roster_assignments`
  // no tiene ON DELETE, así que borrar a un juez designado se rechaza. Aquí se
  // quedaba huérfano el hueco y el campeonato perdía cobertura en silencio.
  const assigned = new Set<string>();
  for (const [competitionId, map] of store.assignments) {
    if (Object.values(map).some((refId) => refId === id)) assigned.add(competitionId);
  }
  if (assigned.size > 0) throw new RefereeAssignedError(assigned.size);
  // Mismo corte que el twin: `promotion_requests.referee_id` no lleva
  // `ON DELETE`, así que en producción el borrado se rechaza. Aquí la
  // solicitud se quedaba apuntando a un juez que ya no existe.
  const promotions = store.promotions.filter((p) => p.refereeId === id).length;
  if (promotions > 0) throw new RefereePromotionsError(promotions);
  store.referees.splice(idx, 1);
  return true;
}

export async function getJudgeProfile(
  refereeId: string,
  getExamsFn: (id: string) => Promise<import("@/lib/types").RefereeExam[]>,
  getReportsFn: (id: string) => Promise<import("@/lib/types").RefereeReport[]>,
): Promise<JudgeProfile | undefined> {
  const referee = await getReferee(refereeId);
  if (!referee) return undefined;
  const store = getStore();
  const [exams, reports] = await Promise.all([
    getExamsFn(refereeId),
    getReportsFn(refereeId),
  ]);
  const sanctions = store.sanctions.filter((s) => s.refereeId === refereeId);
  return computeJudgeProfile(
    referee,
    exams,
    reports,
    sanctions,
    buildMemoryCompetitionHistory(refereeId),
  );
}

export async function listRefereeSanctions(refereeId: string) {
  const store = getStore();
  return store.sanctions
    .filter((s) => s.refereeId === refereeId)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function getActiveSanction(refereeId: string, listFn: (id: string) => Promise<import("@/lib/types").RefereeSanction[]>) {
  const list = await listFn(refereeId);
  const { isSanctionActive } = await import("@/lib/sanctions");
  return list.find((s) => isSanctionActive(s));
}
