import type { EventType, RosterCategoria } from "@/lib/types";

/** Bloque de día detectado en el horario. */
export interface ParsedDay {
  /** Texto literal: "Viernes, 15 de mayo de 2026". */
  raw: string;
  /** Día corto sugerido para el editor: "Viernes". */
  short: string;
  /** Fecha ISO (YYYY-MM-DD) si se pudo deducir. */
  iso?: string;
}

export interface ParsedGrupo {
  nombre: string;
  rawCategoria: string;
  categorias: RosterCategoria[];
  levantadores?: number;
}

export interface ParsedSession {
  /** "S1", "S2"… (basado en el número detectado tras "SESIÓN"). */
  sesion: string;
  /** Etiqueta legible: "Sesión 1". */
  nombre: string;
  /** Día al que pertenece. */
  dia: ParsedDay;
  /** Texto literal de las categorías de la sesión. */
  rawCategoria?: string;
  categorias: RosterCategoria[];
  /** Total de levantadores declarado a nivel sesión. */
  totalLevantadores?: number;
  /** Pesaje "10:30 - 12:00". */
  horarioPesaje?: string;
  /** Competición "12:30 - 15:45" (Inicio - Fin). */
  horarioCompeticion?: string;
  grupos: ParsedGrupo[];
}

/** Cabecera detectada en las primeras líneas del PDF. */
export interface ParsedHeader {
  campeonato?: string;
  tipo?: EventType;
  sede?: string;
  fechasTexto?: string;
  revision?: string;
}

export interface ParsedHorario {
  header: ParsedHeader;
  days: ParsedDay[];
  sessions: ParsedSession[];
  warnings: string[];
}
