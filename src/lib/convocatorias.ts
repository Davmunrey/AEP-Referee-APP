/**
 * Convocatorias: tipos y reglas puras (cliente y servidor).
 *
 * Una convocatoria recoge quién se ofrece para cada sesión de un campeonato.
 * No asigna: el delegado monta la tarima con los inscritos.
 */
import { zonesMatch } from "@/lib/aep-zones";
import { todayIso } from "@/lib/business-date";
import type { EventType, Referee, RosterSession } from "@/lib/types";

export type ConvocatoriaEstado = "abierta" | "cerrada" | "cancelada";
export type ConvocatoriaZonaEstado = "aceptada" | "pendiente" | "rechazada";
export type ConvocatoriaZonaOrigen = "propia" | "delegado" | "automatica";

export interface ConvocatoriaZona {
  zona: string;
  estado: ConvocatoriaZonaEstado;
  origen: ConvocatoriaZonaOrigen;
  solicitadaAt?: string;
  resueltaPor?: string;
  resueltaAt?: string;
}

export interface Convocatoria {
  id: string;
  competitionId: string;
  estado: ConvocatoriaEstado;
  /** Claves de sesión de la plantilla incluidas. */
  sesiones: string[];
  /** Último día para apuntarse (ISO, inclusive, día natural español). */
  cierraEl: string;
  mensaje?: string;
  /** Días antes del cierre en que se pide ayuda a las demás zonas si faltan inscritos. */
  ampliarDiasAntes?: number;
  ampliadaAt?: string;
  creadaPor?: string;
  /** Cuenta que la lanzó: recibe la respuesta de las zonas a las que pidió ayuda. */
  creadaPorId?: string;
  createdAt?: string;
  zonas: ConvocatoriaZona[];
}

export interface Inscripcion {
  convocatoriaId: string;
  refereeId: string;
  sesion: string;
  nota?: string;
  createdAt?: string;
}

/** El juez confirma que va a su designación, o dice que no puede. */
export interface DesignacionRespuesta {
  estado: "confirmada" | "rechazada";
  motivo?: string;
  updatedAt?: string;
}

/** Una zona a la que se ha pedido sumarse a una convocatoria y aún no responde. */
export interface ZonaPendiente {
  convocatoriaId: string;
  zona: string;
  origen: ConvocatoriaZonaOrigen;
  solicitadaAt?: string;
}

/** Una petición de sumarse, con lo que necesita quien la responde. */
export interface SolicitudDeZona extends ZonaPendiente {
  competitionId: string;
  competitionName: string;
  competitionZona?: string;
  fecha: string;
  cierraEl: string;
}

/** Lo que ve el delegado: la convocatoria y quién se ha apuntado a qué. */
export interface ConvocatoriaStaffView {
  convocatoria: Convocatoria;
  inscripciones: Inscripcion[];
}

export interface PortalConvocatoriaSesion {
  session: string;
  nombre: string;
  dia: string;
  horarioCompeticion: string;
  horarioPesaje: string;
  inscrito: boolean;
  /** Por qué no se puede apuntar a esta sesión, si no puede. */
  bloqueo?: string;
}

/** Lo que ve un juez de una convocatoria abierta para él. */
export interface PortalConvocatoria {
  id: string;
  competitionId: string;
  competitionName: string;
  tipo: EventType;
  sede: string;
  zona?: string;
  fecha: string;
  fechaFin: string;
  cierraEl: string;
  mensaje?: string;
  /** El campeonato es de otra zona: llega porque su delegado la abrió a la tuya. */
  otraZona: boolean;
  abierta: boolean;
  /** Bloqueo que afecta a toda la convocatoria (sanción, ficha inactiva…). */
  bloqueo?: string;
  /**
   * Aviso que no impide apuntarse: ya está designado en otro campeonato esas
   * fechas. En uno de varios días puede no chocar, y lo decide el delegado.
   */
  aviso?: string;
  sesiones: PortalConvocatoriaSesion[];
}

export function isConvocatoriaAbierta(c: Pick<Convocatoria, "estado" | "cierraEl">, today = todayIso()): boolean {
  return c.estado === "abierta" && today <= c.cierraEl;
}

/** ¿Llega la convocatoria a esta zona? Solo las zonas aceptadas. */
export function zonaConvocada(c: Pick<Convocatoria, "zonas">, zona: string | undefined): boolean {
  if (!zona) return false;
  return c.zonas.some((z) => z.estado === "aceptada" && zonesMatch(z.zona, zona));
}

export interface BloqueoInput {
  referee: Referee;
  tieneSancionActiva: boolean;
}

/** Bloqueo que impide apuntarse a cualquier sesión. */
export function bloqueoGeneral({ referee, tieneSancionActiva }: BloqueoInput): string | undefined {
  if (tieneSancionActiva) return "Tienes una sanción activa: no puedes apuntarte mientras dure.";
  if (referee.estado !== "Activo") return "Tu ficha figura como inactiva. Habla con tu delegado de zona.";
  // Las mismas dos condiciones que impiden asignar en la tarima
  // (`validateAssignment`). El nivel no bloquea: en la tarima es una
  // recomendación, y el delegado decide con quién cubre cada función.
  if (!referee.disp) return "Tu ficha figura como no disponible. Habla con tu delegado de zona.";
  return undefined;
}

/** Bloqueo de una sesión concreta (además del general). */
export function bloqueoSesion(session: RosterSession | undefined): string | undefined {
  if (!session) return "Esta sesión ya no está en la plantilla del campeonato.";
  return undefined;
}

/** ¿Se solapan dos rangos de fechas ISO (inclusive)? */
export function rangosSeSolapan(a: { fecha: string; fechaFin: string }, b: { fecha: string; fechaFin: string }): boolean {
  return a.fecha <= (b.fechaFin || b.fecha) && b.fecha <= (a.fechaFin || a.fecha);
}

/** Inscritos por sesión, para la tarima. */
export function inscritosPorSesion(inscripciones: Inscripcion[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const i of inscripciones) (out[i.sesion] ??= []).push(i.refereeId);
  return out;
}

export const CONVOCATORIA_ESTADO_LABEL: Record<ConvocatoriaEstado, string> = {
  abierta: "Abierta",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};
