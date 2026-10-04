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
  type SolicitudDeZona,
  type ZonaPendiente,
} from "@/lib/convocatorias";
import type { Competition, RosterSession, SessionUser } from "@/lib/types";
import type { NuevaNotificacion } from "@/lib/notificaciones";
import { AEP_MACRO_ZONES, zoneUiName } from "@/lib/aep-zones";
import { addDaysIso } from "@/lib/business-date";
import { isRosterLockedByApproval } from "@/lib/roster-coverage";
import { sessionRoleEntries } from "@/lib/roster-template";
import { formatDateRange } from "@/lib/utils";
import { cuentasDeJueces, cuentasDeJuecesDeZona, delegadosDeZona, gestionNacional } from "@/server/destinatarios";
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
  /** Otras zonas a las que se abre desde el principio. */
  zonasExtra?: string[];
  /** Si a estos días del cierre faltan inscritos, se pide ayuda a las demás zonas. */
  ampliarDiasAntes?: number;
}

type Actor = { id: string; nombre: string; role: SessionUser["role"]; zona?: string };

/** Gestión nacional: abre zonas sin esperar a que su delegado acepte. */
const esNacional = (actor: Actor) => actor.role === "super_admin" || actor.role === "delegado_jueces";

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
  actor: Actor,
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
  const ampliar = input.ampliarDiasAntes;
  if (ampliar !== undefined && (!Number.isInteger(ampliar) || ampliar < 1 || ampliar > 60)) {
    throw new UserFacingServiceError("Los días para pedir ayuda a otras zonas van de 1 a 60.", 400);
  }
  const zonas: ConvocatoriaZona[] = [
    { zona, estado: "aceptada", origen: "propia", resueltaPor: actor.nombre },
    ...zonasNuevas(actor, zona, input.zonasExtra ?? [], "delegado"),
  ];
  const convocatoria = await dataService.insertConvocatoria({
    competitionId: competition.id,
    estado: "abierta",
    ...valid,
    ampliarDiasAntes: ampliar,
    zonas,
    creadaPor: actor.nombre,
    creadaPorId: actor.id,
  });
  await avisarZonas(convocatoria, competition, zonas);
  return convocatoria;
}

/** Zonas válidas, distintas de la propia, aceptadas o pendientes según quién las abre. */
function zonasNuevas(actor: Actor, propia: string, pedidas: string[], origen: "delegado" | "automatica"): ConvocatoriaZona[] {
  const codes = [
    ...new Set(pedidas.map((z) => resolveZoneCode(z) as string | undefined).filter((z): z is string => !!z && z !== propia)),
  ];
  // La ampliación automática siempre espera al delegado de la otra zona: así
  // lo decide la AEP para no meter jueces en un campeonato sin que su zona lo
  // sepa. Un nacional que abre a mano sí la acepta en el acto.
  const directa = origen === "delegado" && esNacional(actor);
  return codes.map((code) => ({
    zona: code,
    estado: directa ? "aceptada" : "pendiente",
    origen,
    resueltaPor: directa ? actor.nombre : undefined,
  }));
}

/** Abrir una convocatoria viva a más zonas. */
export async function abrirAOtrasZonas(
  actor: Actor,
  convocatoria: Convocatoria,
  competition: Competition,
  zonas: string[],
): Promise<Convocatoria> {
  if (!isConvocatoriaAbierta(convocatoria) || isCompetitionPast(competition)) {
    throw new UserFacingServiceError("La convocatoria ya está cerrada: reábrela antes de sumar zonas.", 409);
  }
  const propia = resolveZoneCode(competition.zona) ?? "";
  const yaEstan = new Set(convocatoria.zonas.map((z) => z.zona));
  const nuevas = zonasNuevas(actor, propia, zonas, "delegado").filter((z) => !yaEstan.has(z.zona));
  if (nuevas.length === 0) throw new UserFacingServiceError("Esas zonas ya están en la convocatoria.", 400);
  await dataService.addConvocatoriaZonas(convocatoria.id, nuevas);
  const updated = (await dataService.getConvocatoria(convocatoria.id))!;
  await avisarZonas(updated, competition, nuevas);
  return updated;
}

/**
 * El delegado de la zona invitada (o la gestión nacional) acepta o rechaza
 * que sus jueces vean la convocatoria.
 */
export async function resolverZona(actor: Actor, convocatoriaId: string, zona: string, aceptar: boolean): Promise<void> {
  const code = resolveZoneCode(zona);
  if (!code) throw new UserFacingServiceError("Zona no válida.", 400);
  const puede = esNacional(actor) || (actor.role === "delegado_zona" && !!actor.zona && zonesMatch(actor.zona, code));
  if (!puede) throw new UserFacingServiceError("Solo el delegado de esa zona puede responder.", 403);
  const convocatoria = await dataService.getConvocatoria(convocatoriaId);
  if (!convocatoria || convocatoria.estado === "cancelada") {
    throw new UserFacingServiceError("La convocatoria ya no existe.", 404);
  }
  // Aceptar una convocatoria cerrada mandaría a sus jueces un «puedes
  // apuntarte» que ya no es verdad. Rechazarla sí se puede siempre.
  if (aceptar && !isConvocatoriaAbierta(convocatoria)) {
    throw new UserFacingServiceError("La convocatoria ya está cerrada.", 409);
  }
  const ok = await dataService.resolverConvocatoriaZona(convocatoriaId, code, aceptar ? "aceptada" : "rechazada", actor.nombre);
  if (!ok) throw new UserFacingServiceError("Esa petición ya estaba respondida.", 409);
  const data = await dataService.getCompetitionWithRoster(convocatoria.competitionId);
  const nombre = data?.competition.nombre ?? "un campeonato";
  if (aceptar && data) {
    await avisar(await cuentasDeJuecesDeZona(code), {
      tipo: "convocatoria-nueva",
      titulo: `Convocatoria: ${nombre}`,
      cuerpo: `Puedes apuntarte hasta el ${fechaLarga(convocatoria.cierraEl)}.`,
      href: `/portal/convocatorias/${convocatoria.id}`,
      clave: `conv:${convocatoria.id}:nueva`,
    });
  }
  if (convocatoria.creadaPorId) {
    await avisar([convocatoria.creadaPorId], {
      tipo: "zona-resuelta",
      titulo: `${zoneUiName(code)} ${aceptar ? "se suma" : "no se suma"} a la convocatoria`,
      cuerpo: `${nombre}: ${aceptar ? "sus jueces ya pueden apuntarse." : "su delegado ha rechazado la petición."}`,
      href: `/competitions/${convocatoria.competitionId}`,
    });
  }
}

/** Peticiones de sumarse que puede responder este usuario. */
export async function solicitudesParaUsuario(user: Actor): Promise<SolicitudDeZona[]> {
  let pendientes: ZonaPendiente[];
  if (esNacional(user)) pendientes = await dataService.listZonasPendientes();
  else if (user.role === "delegado_zona" && user.zona) {
    const code = resolveZoneCode(user.zona);
    pendientes = code ? await dataService.listZonasPendientes(code) : [];
  } else return [];
  const out: SolicitudDeZona[] = [];
  for (const p of pendientes) {
    const c = await dataService.getConvocatoria(p.convocatoriaId);
    if (!c || !isConvocatoriaAbierta(c)) continue;
    const data = await dataService.getCompetitionWithRoster(c.competitionId);
    if (!data || isCompetitionPast(data.competition)) continue;
    out.push({
      ...p,
      competitionId: c.competitionId,
      competitionName: data.competition.nombre,
      competitionZona: data.competition.zona,
      fecha: data.competition.fecha,
      cierraEl: c.cierraEl,
    });
  }
  return out;
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
  // Sin `sesiones` en el cambio, las guardadas que sigan en la plantilla: si
  // después se quitó una sesión de la plantilla, reabrir o cambiar la fecha no
  // puede quedar bloqueado por ella (el diálogo no reenvía las sesiones).
  const enPlantilla = new Set(template.map((x) => x.sesion));
  const merged = {
    sesiones: patch.sesiones ?? convocatoria.sesiones.filter((x) => enPlantilla.has(x)),
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
    sesiones:
      patch.sesiones !== undefined || (reabre && valid.sesiones.length !== convocatoria.sesiones.length)
        ? valid.sesiones
        : undefined,
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
  // Solo designaciones de tarimas APROBADAS: un borrador de otro delegado no
  // se enseña al juez (el mismo criterio que «Mis sesiones»).
  const busy = await dataService.getRefereeBusyMap(competition.id);
  let designadoEn: string | undefined;
  for (const b of busy[refereeId] ?? []) {
    const other = await dataService.getCompetition(b.competitionId);
    if (other && isRosterLockedByApproval(other.aprobacion)) {
      designadoEn = b.competitionName;
      break;
    }
  }
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


// ── Avisos ─────────────────────────────────────────────────────────────────

function fechaLarga(iso: string): string {
  return formatDateRange(iso, iso);
}

/**
 * Manda el mismo aviso a varias personas. Un fallo aquí se registra y no
 * rompe lo que lo provocó: lanzar una convocatoria no puede fallar porque la
 * campana no se pudo escribir.
 */
async function avisar(userIds: string[], n: Omit<NuevaNotificacion, "userId">): Promise<void> {
  const unicos = [...new Set(userIds.filter(Boolean))];
  if (unicos.length === 0) return;
  try {
    await dataService.insertNotificaciones(unicos.map((userId) => ({ ...n, userId })));
  } catch (err) {
    console.error("[convocatorias.avisar]", err);
  }
}

/** Avisa a los jueces de las zonas aceptadas y a los delegados de las pendientes. */
async function avisarZonas(convocatoria: Convocatoria, competition: Competition, zonas: ConvocatoriaZona[]) {
  try {
    for (const z of zonas) {
      if (z.estado === "aceptada") {
        await avisar(await cuentasDeJuecesDeZona(z.zona), {
          tipo: "convocatoria-nueva",
          titulo: `Convocatoria: ${competition.nombre}`,
          cuerpo: `${fechaLarga(competition.fecha)} · ${competition.sede}. Puedes apuntarte hasta el ${fechaLarga(convocatoria.cierraEl)}.`,
          href: `/portal/convocatorias/${convocatoria.id}`,
          clave: `conv:${convocatoria.id}:nueva`,
        });
      } else if (z.estado === "pendiente") {
        // Sin delegado en esa zona, la petición la ve la gestión nacional.
        const delegados = await delegadosDeZona(z.zona);
        await avisar(delegados.length ? delegados : await gestionNacional(), {
          tipo: "zona-solicitada",
          titulo: `${competition.nombre} pide jueces de ${zoneUiName(z.zona)}`,
          cuerpo:
            z.origen === "automatica"
              ? `Faltan inscritos y la convocatoria pide ayuda a las demás zonas. Acepta para que tus jueces la vean.`
              : `${competition.zona ? zoneUiName(competition.zona) : "Otra zona"} quiere abrir su convocatoria a tus jueces. Acepta para que la vean.`,
          href: "/",
          clave: `conv:${convocatoria.id}:zona:${z.zona}`,
        });
      }
    }
  } catch (err) {
    console.error("[convocatorias.avisarZonas]", err);
  }
}

// ── Revisión periódica (ampliación automática y recordatorio de cierre) ────

let ultimaRevision = 0;
const CADA = 5 * 60 * 1000;

/** Plazas de una sesión (competición + pesaje). */
function plazasDeSesion(session: RosterSession | undefined): number {
  if (!session) return 0;
  return sessionRoleEntries(session).reduce((a, r) => a + Math.max(0, Math.floor(Number(r.slots) || 0)), 0);
}

/**
 * No hay planificador: la revisión corre cuando alguien abre el panel, una
 * tarima o el portal, como mucho cada 5 minutos por instancia. Lo que escribe
 * es condicional (`ampliada_at IS NULL`, claves de aviso únicas), así que dos
 * instancias a la vez no duplican nada.
 */
export async function revisarConvocatorias(now = Date.now()): Promise<void> {
  if (now - ultimaRevision < CADA) return;
  ultimaRevision = now;
  try {
    const hoy = todayIso();
    for (const c of await dataService.listConvocatoriasParaAmpliar()) {
      if (!c.ampliarDiasAntes || hoy < addDaysIso(c.cierraEl, -c.ampliarDiasAntes) || hoy > c.cierraEl) continue;
      const data = await dataService.getCompetitionWithRoster(c.competitionId);
      if (!data) continue;
      const inscripciones = await dataService.listInscripciones(c.id);
      const porSesion = new Map<string, number>();
      for (const i of inscripciones) porSesion.set(i.sesion, (porSesion.get(i.sesion) ?? 0) + 1);
      const faltan = c.sesiones.some((key) => (porSesion.get(key) ?? 0) < plazasDeSesion(data.roster.template.find((s) => s.sesion === key)));
      if (!faltan) continue;
      if (!(await dataService.marcarConvocatoriaAmpliada(c.id))) continue;
      const propia = resolveZoneCode(data.competition.zona) ?? "";
      const yaEstan = new Set(c.zonas.map((z) => z.zona));
      const otras = AEP_MACRO_ZONES.map((z) => z.id as string).filter((code) => code !== propia && !yaEstan.has(code));
      const nuevas = zonasNuevas({ id: "", nombre: "Ampliación automática", role: "solo_ver" }, propia, otras, "automatica");
      await dataService.addConvocatoriaZonas(c.id, nuevas);
      await avisarZonas(c, data.competition, nuevas);
    }

    // Recordatorio: cierra mañana, a quien aún no se ha apuntado a nada.
    const manana = addDaysIso(hoy, 1);
    for (const c of await dataService.listConvocatoriasAbiertas(hoy)) {
      if (c.cierraEl !== manana) continue;
      const data = await dataService.getCompetitionWithRoster(c.competitionId);
      if (!data) continue;
      const apuntados = new Set((await dataService.listInscripciones(c.id)).map((i) => i.refereeId));
      const referees = await dataService.getReferees();
      const zonas = c.zonas.filter((z) => z.estado === "aceptada").map((z) => z.zona);
      const pendientes = referees.filter(
        (r) => !apuntados.has(r.id) && r.estado === "Activo" && r.disp && zonas.some((z) => zonesMatch(r.zona, z)),
      );
      await avisar(await cuentasDeJueces(pendientes.map((r) => r.id)), {
        tipo: "convocatoria-cierra",
        titulo: `Mañana cierra: ${data.competition.nombre}`,
        cuerpo: "Si vas a poder ir a alguna sesión, apúntate hoy.",
        href: `/portal/convocatorias/${c.id}`,
        // Con la fecha en la clave: si se alarga el plazo, hay recordatorio nuevo.
        clave: `conv:${c.id}:cierra:${c.cierraEl}`,
      });
    }
  } catch (err) {
    console.error("[convocatorias.revisar]", err);
  }
}

// ── Designación ────────────────────────────────────────────────────────────

/** Tras aprobar la tarima: cada juez designado recibe su aviso. */
export async function notificarDesignacion(competitionId: string, aprobacionId: string): Promise<void> {
  try {
    const data = await dataService.getCompetitionWithRoster(competitionId);
    if (!data) return;
    // Una tarima aprobada otra vez (tras un imprevisto) pide confirmar de
    // nuevo: el «no puedo» o el «confirmo» de antes eran sobre otra tarima.
    await dataService.clearDesignacionRespuestas(competitionId);
    const ids = [...new Set(Object.values(data.roster.assignments).filter(Boolean))];
    await avisar(await cuentasDeJueces(ids), {
      tipo: "designacion",
      titulo: `Designado en ${data.competition.nombre}`,
      cuerpo: `${fechaLarga(data.competition.fecha)} · ${data.competition.sede}. Mira tus sesiones y confirma que vas.`,
      href: "/portal/sesiones",
      clave: `desig:${competitionId}:${aprobacionId}`,
    });
  } catch (err) {
    console.error("[convocatorias.notificarDesignacion]", err);
  }
}

/**
 * El juez confirma o rechaza su designación. Solo en una tarima aprobada en
 * la que esté, y antes de que acabe el campeonato.
 */
export async function responderDesignacion(
  refereeId: string,
  competitionId: string,
  estado: "confirmada" | "rechazada",
  motivo?: string,
): Promise<void> {
  const data = await dataService.getCompetitionWithRoster(competitionId);
  const asignado = !!data && Object.values(data.roster.assignments).includes(refereeId);
  if (!data || !asignado || !isRosterLockedByApproval(data.competition.aprobacion)) {
    throw new UserFacingServiceError("No tienes una designación aprobada en ese campeonato.", 404);
  }
  if (isCompetitionPast(data.competition)) throw new UserFacingServiceError("El campeonato ya se ha celebrado.", 409);
  const limpio = motivo?.trim() || undefined;
  if (estado === "rechazada" && !limpio) {
    throw new UserFacingServiceError("Cuéntale a tu delegado por qué no puedes ir.", 400);
  }
  if (limpio && limpio.length > MAX_NOTA) throw new UserFacingServiceError(`Máximo ${MAX_NOTA} caracteres.`, 400);
  const anterior = (await dataService.getRespuestasDeJuez(refereeId))[competitionId];
  await dataService.setDesignacionRespuesta(competitionId, refereeId, { estado, motivo: limpio });
  // Solo al pasar a «no puedo»: repetir la misma respuesta no vuelve a llenar
  // la campana de la gestión.
  if (estado === "rechazada" && anterior?.estado !== "rechazada") {
    const referee = await dataService.getReferee(refereeId);
    const delegados = data.competition.zona ? await delegadosDeZona(data.competition.zona) : [];
    await avisar([...delegados, ...(await gestionNacional())], {
      tipo: "designacion-rechazada",
      titulo: `${referee?.nombre ?? "Un juez"} no puede ir a ${data.competition.nombre}`,
      cuerpo: limpio,
      href: `/competitions/${competitionId}`,
    });
  }
}
