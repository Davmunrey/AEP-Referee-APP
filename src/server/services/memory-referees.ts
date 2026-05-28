import { normalizeZoneInput } from "@/lib/aep-zones";
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
  return store.referees.filter((r) => {
    if (params?.user?.role === "delegado_zona" && params.user.zona && r.zona !== params.user.zona) {
      return false;
    }
    if (params?.zona && params.zona !== "TODAS" && r.zona !== params.zona) return false;
    if (params?.nivel && params.nivel !== "TODOS" && r.nivel !== params.nivel) return false;
    if (params?.estado && params.estado !== "TODOS" && r.estado !== params.estado) return false;
    if (params?.q && !r.nombre.toLowerCase().includes(params.q.toLowerCase())) return false;
    return true;
  });
}

export async function getReferee(id: string) {
  return getStore().referees.find((r) => r.id === id);
}

export async function createReferee(input: Omit<Referee, "id" | "iniciales">): Promise<Referee> {
  const store = getStore();
  const id = `j${String(store.referees.length + 1).padStart(3, "0")}`;
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
