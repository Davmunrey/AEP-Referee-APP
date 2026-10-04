/**
 * Convocatorias: las reglas, igual para los dos backends.
 *
 * El almacenamiento (Supabase o memoria) solo guarda y lee; aquí se decide
 * quién puede lanzar qué, quién puede apuntarse a qué y hasta cuándo. Todo lo
 * que hace un juez pasa por aquí con SU ficha (`refereeId` de la sesión): el
 * portal nunca recibe de la petición a quién apuntar.
 */
import { resolveZoneCode, zonesMatch } from "@/lib/aep-zones";
import { todayIso } from "@/lib/business-date";
import { isCompetitionPast } from "@/lib/competition-status";
import { UserFacingServiceError } from "@/lib/competitions/service-types";
import {
  bloqueoGeneral,
  bloqueoSesion,
  isConvocatoriaAbierta,
  zonaConvocada,
  type Convocatoria,
  type ConvocatoriaStaffView,
  type ConvocatoriaZona,
  type PortalConvocatoria,
} from "@/lib/convocatorias";
import type { Competition, RosterSession } from "@/lib/types";
import { dataService } from "@/server/services";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MENSAJE = 1000;
const MAX_NOTA = 500;

/** La convocatoria viva de un campeonato y sus inscripciones. */
export async function getConvocatoriaDeCampeonato(competitionId: string): Promise<ConvocatoriaStaffView | null> {
  const convocatoria = await dataService.getLiveConvocatoria(competitionId);
  if (!convocatoria) return null;
  return { convocatoria, inscripciones: await dataService.listInscripciones(convocatoria.id) };
}

export interface ConvocatoriaInput {
  sesiones: string[];
  cierraEl: string;
  mensaje?: string;
}

function validarInput(input: ConvocatoriaInput, competition: Competition, template: RosterSession[]) {
  const enPlantilla = new Set(template.map((s) => s.sesion));
  const sesiones = [...new Set(input.sesiones)].filter((s) => enPlantilla.has(s));
  if (sesiones.length === 0) throw new UserFacingServiceError("Elige al menos una sesión de la plantilla.", 400);
  if (sesiones.length !== new Set(input.sesiones).size) {
    throw new UserFacingServiceError("Alguna sesión ya no está en la plantilla. Recarga la página.", 409);
  }
  if (!ISO_DATE.test(input.cierraEl)) throw new UserFacingServiceError("Fecha límite no válida.", 400);
  if (input.cierraEl < todayIso()) throw new UserFacingServiceError("La fecha límite no puede ser anterior a hoy.", 400);
  if (input.cierraEl > competition.fecha) {
    throw new UserFacingServiceError("La fecha límite tiene que ser anterior al campeonato.", 400);
  }
  const mensaje = input.mensaje?.trim() || undefined;
  if (mensaje && mensaje.length > MAX_MENSAJE) {
    throw new UserFacingServiceError(`El mensaje no puede pasar de ${MAX_MENSAJE} caracteres.`, 400);
  }
  return { sesiones, cierraEl: input.cierraEl, mensaje };
}

/** Lanzar la convocatoria de un campeonato. Quien llama ya comprobó el permiso. */
export async function crearConvocatoria(
  actor: { id: string; nombre: string },
  competition: Competition,
  template: RosterSession[],
  input: ConvocatoriaInput,
): Promise<Convocatoria> {
  if (isCompetitionPast(competition)) throw new UserFacingServiceError("El campeonato ya se ha celebrado.", 400);
  const zona = resolveZoneCode(competition.zona);
  if (!zona) {
    throw new UserFacingServiceError("El campeonato no tiene zona: asígnale una para saber a qué jueces convocar.", 400);
  }
  const valid = validarInput(input, competition, template);
  const zonas: ConvocatoriaZona[] = [{ zona, estado: "aceptada", origen: "propia", resueltaPor: actor.nombre }];
  return dataService.insertConvocatoria({
    competitionId: competition.id,
    estado: "abierta",
    ...valid,
    zonas,
    creadaPor: actor.nombre,
    creadaPorId: actor.id,
  });
}

export interface ConvocatoriaPatch {
  estado?: "abierta" | "cerrada" | "cancelada";
  cierraEl?: string;
  mensaje?: string;
  sesiones?: string[];
}

export async function actualizarConvocatoria(
  convocatoria: Convocatoria,
  competition: Competition,
  template: RosterSession[],
  patch: ConvocatoriaPatch,
): Promise<Convocatoria> {
  if (convocatoria.estado === "cancelada" && patch.estado !== "abierta") {
    throw new UserFacingServiceError("La convocatoria está cancelada.", 409);
  }
  const merged = {
    sesiones: patch.sesiones ?? convocatoria.sesiones,
    cierraEl: patch.cierraEl ?? convocatoria.cierraEl,
    mensaje: patch.mensaje ?? convocatoria.mensaje,
  };
  // Reabrir o cambiar fechas y sesiones se valida igual que al lanzarla; cerrar
  // o cancelar no (se puede cerrar una convocatoria cuya fecha ya pasó).
  const reabre = patch.estado === "abierta" || patch.cierraEl !== undefined || patch.sesiones !== undefined;
  const valid = reabre ? validarInput(merged, competition, template) : { ...merged };
  const updated = await dataService.updateConvocatoria(convocatoria.id, {
    estado: patch.estado,
    cierraEl: patch.cierraEl !== undefined ? valid.cierraEl : undefined,
    sesiones: patch.sesiones !== undefined ? valid.sesiones : undefined,
    mensaje: patch.mensaje !== undefined ? (patch.mensaje.trim() || "") : undefined,
  });
  if (!updated) throw new UserFacingServiceError("La convocatoria ya no existe. Recarga la página.", 404);
  return updated;
}

// ── Portal ─────────────────────────────────────────────────────────────────

async function vistaParaJuez(
  convocatoria: Convocatoria,
  refereeId: string,
  ctx: {
    referee: import("@/lib/types").Referee;
    tieneSancionActiva: boolean;
    inscritas: Set<string>;
  },
): Promise<PortalConvocatoria | null> {
  const data = await dataService.getCompetitionWithRoster(convocatoria.competitionId);
  if (!data || isCompetitionPast(data.competition)) return null;
  const { competition, roster } = data;
  const busy = await dataService.getRefereeBusyMap(competition.id);
  const designadoEn = busy[refereeId]?.[0]?.competitionName;
  const general = bloqueoGeneral({ referee: ctx.referee, tieneSancionActiva: ctx.tieneSancionActiva });
  const byKey = new Map(roster.template.map((s) => [s.sesion, s]));
  return {
    id: convocatoria.id,
    competitionId: competition.id,
    competitionName: competition.nombre,
    tipo: competition.tipo,
    sede: competition.sede,
    zona: competition.zona,
    fecha: competition.fecha,
    fechaFin: competition.fechaFin,
    cierraEl: convocatoria.cierraEl,
    mensaje: convocatoria.mensaje,
    otraZona: !zonesMatch(competition.zona, ctx.referee.zona),
    abierta: isConvocatoriaAbierta(convocatoria),
    bloqueo: general,
    aviso: designadoEn ? `Esas fechas ya estás designado en ${designadoEn}. Apúntate solo a las sesiones a las que llegues.` : undefined,
    sesiones: convocatoria.sesiones.map((key) => {
      const s = byKey.get(key);
      return {
        session: key,
        nombre: s?.nombre || key,
        dia: s?.dia ?? "",
        horarioCompeticion: s?.horarioCompeticion ?? "",
        horarioPesaje: s?.horarioPesaje ?? "",
        inscrito: ctx.inscritas.has(key),
        bloqueo: bloqueoSesion(s),
      };
    }),
  };
}

async function contextoDeJuez(refereeId: string, convocatoriaIds: string[]) {
  const [referee, sanction, mias] = await Promise.all([
    dataService.getReferee(refereeId),
    dataService.getActiveSanction(refereeId),
    dataService.listInscripcionesDeJuez(refereeId, convocatoriaIds),
  ]);
  if (!referee) throw new UserFacingServiceError("No encontramos tu ficha del censo.", 404);
  return { referee, tieneSancionActiva: Boolean(sanction), mias };
}

/** Las convocatorias abiertas para el juez (su zona, aceptada). */
export async function convocatoriasParaJuez(refereeId: string): Promise<PortalConvocatoria[]> {
  const referee = await dataService.getReferee(refereeId);
  if (!referee) return [];
  const abiertas = await dataService.listConvocatoriasAbiertasParaZona(referee.zona, todayIso());
  if (abiertas.length === 0) return [];
  const ctx = await contextoDeJuez(refereeId, abiertas.map((c) => c.id));
  const views = await Promise.all(
    abiertas.map((c) =>
      vistaParaJuez(c, refereeId, {
        ...ctx,
        inscritas: new Set(ctx.mias.filter((i) => i.convocatoriaId === c.id).map((i) => i.sesion)),
      }),
    ),
  );
  return views.filter((v): v is PortalConvocatoria => v !== null).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Una convocatoria concreta, si el juez la puede ver. */
export async function convocatoriaParaJuez(refereeId: string, convocatoriaId: string): Promise<PortalConvocatoria | null> {
  const [convocatoria, referee] = await Promise.all([
    dataService.getConvocatoria(convocatoriaId),
    dataService.getReferee(refereeId),
  ]);
  // Una convocatoria que no llega a su zona no existe para él (404, no 403:
  // no se confirma que exista).
  if (!convocatoria || !referee || !zonaConvocada(convocatoria, referee.zona)) return null;
  if (convocatoria.estado === "cancelada") return null;
  const ctx = await contextoDeJuez(refereeId, [convocatoria.id]);
  return vistaParaJuez(convocatoria, refereeId, { ...ctx, inscritas: new Set(ctx.mias.map((i) => i.sesion)) });
}

/** El juez se apunta a una sesión. Devuelve la convocatoria actualizada. */
export async function apuntarse(
  refereeId: string,
  convocatoriaId: string,
  sesion: string,
  nota?: string,
): Promise<PortalConvocatoria> {
  const vista = await convocatoriaParaJuez(refereeId, convocatoriaId);
  if (!vista) throw new UserFacingServiceError("Esta convocatoria no está disponible para ti.", 404);
  if (!vista.abierta) throw new UserFacingServiceError("La convocatoria ya está cerrada.", 409);
  if (vista.bloqueo) throw new UserFacingServiceError(vista.bloqueo, 409);
  const s = vista.sesiones.find((x) => x.session === sesion);
  if (!s) throw new UserFacingServiceError("Esa sesión no está en la convocatoria.", 400);
  if (s.bloqueo) throw new UserFacingServiceError(s.bloqueo, 409);
  const notaLimpia = nota?.trim() || undefined;
  if (notaLimpia && notaLimpia.length > MAX_NOTA) {
    throw new UserFacingServiceError(`La nota no puede pasar de ${MAX_NOTA} caracteres.`, 400);
  }
  await dataService.insertInscripcion({ convocatoriaId, refereeId, sesion, nota: notaLimpia });
  return { ...vista, sesiones: vista.sesiones.map((x) => (x.session === sesion ? { ...x, inscrito: true } : x)) };
}

/** El juez se retira de una sesión (solo mientras la convocatoria siga abierta). */
export async function retirarse(refereeId: string, convocatoriaId: string, sesion: string): Promise<PortalConvocatoria> {
  const vista = await convocatoriaParaJuez(refereeId, convocatoriaId);
  if (!vista) throw new UserFacingServiceError("Esta convocatoria no está disponible para ti.", 404);
  // Cerrada, el delegado ya está montando la tarima con lo apuntado: retirarse
  // es avisarle a él, no borrar la fila sin que se entere.
  if (!vista.abierta) {
    throw new UserFacingServiceError("La convocatoria ya está cerrada. Si no puedes ir, avisa a tu delegado.", 409);
  }
  await dataService.deleteInscripcion(convocatoriaId, refereeId, sesion);
  return { ...vista, sesiones: vista.sesiones.map((x) => (x.session === sesion ? { ...x, inscrito: false } : x)) };
}
