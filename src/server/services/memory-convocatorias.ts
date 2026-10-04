/** Convocatorias en memoria: mismo contrato que `supabase-convocatorias`. */
import { resolveZoneCode, zonesMatch } from "@/lib/aep-zones";
import type { Convocatoria, ConvocatoriaZona, DesignacionRespuesta, Inscripcion, ZonaPendiente } from "@/lib/convocatorias";
import { UserFacingServiceError } from "@/lib/competitions/service-types";
import { todayIso } from "@/lib/business-date";
import { getStore, nextSeqId } from "@/server/store";

function store() {
  const s = getStore();
  // Un store creado antes de esta versión (recarga en caliente) no las trae.
  s.convocatorias ??= [];
  s.inscripciones ??= [];
  s.respuestas ??= new Map();
  return s;
}

const copy = (c: Convocatoria): Convocatoria => ({ ...c, sesiones: [...c.sesiones], zonas: c.zonas.map((z) => ({ ...z })) });

async function getConvocatoria(id: string): Promise<Convocatoria | null> {
  const c = store().convocatorias.find((x) => x.id === id);
  return c ? copy(c) : null;
}

async function getLiveConvocatoria(competitionId: string): Promise<Convocatoria | null> {
  const c = store().convocatorias.find((x) => x.competitionId === competitionId && x.estado !== "cancelada");
  return c ? copy(c) : null;
}

async function listConvocatoriasAbiertasParaZona(zona: string, desde: string): Promise<Convocatoria[]> {
  const code = resolveZoneCode(zona);
  if (!code) return [];
  return store()
    .convocatorias.filter(
      (c) => c.estado === "abierta" && c.cierraEl >= desde && c.zonas.some((z) => z.estado === "aceptada" && zonesMatch(z.zona, code)),
    )
    .sort((a, b) => a.cierraEl.localeCompare(b.cierraEl))
    .map(copy);
}

async function insertConvocatoria(input: Omit<Convocatoria, "id" | "createdAt">): Promise<Convocatoria> {
  const s = store();
  if (s.convocatorias.some((c) => c.competitionId === input.competitionId && c.estado !== "cancelada")) {
    throw new UserFacingServiceError("Este campeonato ya tiene una convocatoria. Recarga la página para verla.");
  }
  const now = new Date().toISOString();
  const c: Convocatoria = {
    ...input,
    id: nextSeqId("conv"),
    createdAt: now,
    zonas: input.zonas.map((z) => ({ ...z, solicitadaAt: now, resueltaAt: z.estado === "pendiente" ? undefined : now })),
  };
  s.convocatorias.push(c);
  return copy(c);
}

async function updateConvocatoria(
  id: string,
  patch: Partial<Pick<Convocatoria, "estado" | "cierraEl" | "mensaje" | "sesiones" | "ampliarDiasAntes">>,
): Promise<Convocatoria | null> {
  const s = store();
  const c = s.convocatorias.find((x) => x.id === id);
  if (!c) return null;
  if (patch.estado && patch.estado !== "cancelada" && c.estado === "cancelada") {
    if (s.convocatorias.some((x) => x.id !== id && x.competitionId === c.competitionId && x.estado !== "cancelada")) {
      throw new UserFacingServiceError("Este campeonato ya tiene otra convocatoria viva.");
    }
  }
  if (patch.estado !== undefined) c.estado = patch.estado;
  if (patch.cierraEl !== undefined) c.cierraEl = patch.cierraEl;
  if (patch.mensaje !== undefined) c.mensaje = patch.mensaje || undefined;
  if (patch.sesiones !== undefined) c.sesiones = [...patch.sesiones];
  if (patch.ampliarDiasAntes !== undefined) c.ampliarDiasAntes = patch.ampliarDiasAntes ?? undefined;
  return copy(c);
}

async function listInscripciones(convocatoriaId: string): Promise<Inscripcion[]> {
  return store().inscripciones.filter((i) => i.convocatoriaId === convocatoriaId).map((i) => ({ ...i }));
}

async function listInscripcionesDeJuez(refereeId: string, convocatoriaIds: string[]): Promise<Inscripcion[]> {
  const ids = new Set(convocatoriaIds);
  return store().inscripciones.filter((i) => i.refereeId === refereeId && ids.has(i.convocatoriaId)).map((i) => ({ ...i }));
}

async function insertInscripcion(i: Inscripcion): Promise<void> {
  const s = store();
  const dup = s.inscripciones.some(
    (x) => x.convocatoriaId === i.convocatoriaId && x.refereeId === i.refereeId && x.sesion === i.sesion,
  );
  if (!dup) s.inscripciones.push({ ...i, createdAt: new Date().toISOString() });
}

async function deleteInscripcion(convocatoriaId: string, refereeId: string, sesion: string): Promise<boolean> {
  const s = store();
  const before = s.inscripciones.length;
  s.inscripciones = s.inscripciones.filter(
    (x) => !(x.convocatoriaId === convocatoriaId && x.refereeId === refereeId && x.sesion === sesion),
  );
  return s.inscripciones.length < before;
}


async function addConvocatoriaZonas(convocatoriaId: string, zonas: ConvocatoriaZona[]): Promise<void> {
  const c = store().convocatorias.find((x) => x.id === convocatoriaId);
  if (!c) return;
  const now = new Date().toISOString();
  for (const z of zonas) {
    if (c.zonas.some((x) => x.zona === z.zona)) continue;
    c.zonas.push({ ...z, solicitadaAt: now, resueltaAt: z.estado === "pendiente" ? undefined : now });
  }
}

async function resolverConvocatoriaZona(
  convocatoriaId: string,
  zona: string,
  estado: "aceptada" | "rechazada",
  resueltaPor: string,
): Promise<boolean> {
  const z = store().convocatorias.find((x) => x.id === convocatoriaId)?.zonas.find((x) => x.zona === zona);
  if (!z || z.estado !== "pendiente") return false;
  Object.assign(z, { estado, resueltaPor, resueltaAt: new Date().toISOString() });
  return true;
}

async function listZonasPendientes(zona?: string): Promise<ZonaPendiente[]> {
  return store()
    .convocatorias.flatMap((c) =>
      c.zonas
        .filter((z) => z.estado === "pendiente" && (!zona || z.zona === zona))
        .map((z) => ({ convocatoriaId: c.id, zona: z.zona, origen: z.origen, solicitadaAt: z.solicitadaAt })),
    )
    .sort((a, b) => (b.solicitadaAt ?? "").localeCompare(a.solicitadaAt ?? ""))
    .slice(0, 200);
}

async function listConvocatoriasAbiertas(desde: string): Promise<Convocatoria[]> {
  return store().convocatorias.filter((c) => c.estado === "abierta" && c.cierraEl >= desde).map(copy);
}

async function listConvocatoriasParaAmpliar(): Promise<Convocatoria[]> {
  return store()
    .convocatorias.filter((c) => c.estado === "abierta" && c.ampliarDiasAntes != null && !c.ampliadaAt && c.cierraEl >= todayIso())
    .map(copy);
}

async function marcarConvocatoriaAmpliada(id: string): Promise<boolean> {
  const c = store().convocatorias.find((x) => x.id === id);
  if (!c || c.ampliadaAt) return false;
  c.ampliadaAt = new Date().toISOString();
  return true;
}

const respKey = (competitionId: string, refereeId: string) => `${competitionId}::${refereeId}`;

async function getDesignacionRespuestas(competitionId: string): Promise<Record<string, DesignacionRespuesta>> {
  const out: Record<string, DesignacionRespuesta> = {};
  for (const [k, v] of store().respuestas) {
    const [comp, ref] = k.split("::");
    if (comp === competitionId && ref) out[ref] = { ...v };
  }
  return out;
}

async function getRespuestasDeJuez(refereeId: string): Promise<Record<string, DesignacionRespuesta>> {
  const out: Record<string, DesignacionRespuesta> = {};
  for (const [k, v] of store().respuestas) {
    const [comp, ref] = k.split("::");
    if (ref === refereeId && comp) out[comp] = { ...v };
  }
  return out;
}

async function clearDesignacionRespuestas(competitionId: string): Promise<void> {
  const r = store().respuestas;
  for (const k of [...r.keys()]) if (k.startsWith(`${competitionId}::`)) r.delete(k);
}

async function setDesignacionRespuesta(
  competitionId: string,
  refereeId: string,
  respuesta: Omit<DesignacionRespuesta, "updatedAt">,
): Promise<void> {
  store().respuestas.set(respKey(competitionId, refereeId), { ...respuesta, updatedAt: new Date().toISOString() });
}

export const memoryConvocatoriaService = {
  getConvocatoria,
  getLiveConvocatoria,
  listConvocatoriasAbiertasParaZona,
  insertConvocatoria,
  updateConvocatoria,
  listInscripciones,
  listInscripcionesDeJuez,
  insertInscripcion,
  deleteInscripcion,
  addConvocatoriaZonas,
  resolverConvocatoriaZona,
  listZonasPendientes,
  listConvocatoriasParaAmpliar,
  listConvocatoriasAbiertas,
  marcarConvocatoriaAmpliada,
  getDesignacionRespuestas,
  getRespuestasDeJuez,
  setDesignacionRespuesta,
  clearDesignacionRespuestas,
};
