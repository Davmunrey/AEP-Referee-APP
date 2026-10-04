/** Convocatorias en memoria: mismo contrato que `supabase-convocatorias`. */
import { resolveZoneCode, zonesMatch } from "@/lib/aep-zones";
import type { Convocatoria, Inscripcion } from "@/lib/convocatorias";
import { UserFacingServiceError } from "@/lib/competitions/service-types";
import { getStore, nextSeqId } from "@/server/store";

function store() {
  const s = getStore();
  // Un store creado antes de esta versión (recarga en caliente) no las trae.
  s.convocatorias ??= [];
  s.inscripciones ??= [];
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

async function insertConvocatoria(input: Omit<Convocatoria, "id" | "createdAt"> & { creadaPorId?: string }): Promise<Convocatoria> {
  const s = store();
  if (s.convocatorias.some((c) => c.competitionId === input.competitionId && c.estado !== "cancelada")) {
    throw new UserFacingServiceError("Este campeonato ya tiene una convocatoria. Recarga la página para verla.");
  }
  const { creadaPorId: _id, ...rest } = input;
  const now = new Date().toISOString();
  const c: Convocatoria = {
    ...rest,
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
};
