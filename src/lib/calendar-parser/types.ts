import type { EventType } from "@/lib/types";

/** Una entrada cruda detectada en el calendario AEP. */
export interface ParsedCalendarEntry {
  rawDate: string;
  /** Fecha de inicio en formato `YYYY-MM-DD` (`null` si "pendiente" / no parseable). */
  fechaInicio: string | null;
  /** Fecha fin en formato `YYYY-MM-DD` (igual a inicio si single day). */
  fechaFin: string | null;
  nombre: string;
  /** Localidad (puede incluir provincia entre paréntesis). */
  localidad: string;
  /** Provincia detectada entre paréntesis o última línea. */
  provincia?: string;
  organizador: string;
  /** Texto literal del campo NIVEL del PDF (`AEP1`, `AEP2`, `AEP3`, `EPF`, `IPF`, `ESP.`, etc). */
  nivelRaw: string;
  /** Tipo derivado para AEP Tarima si aplica. `null` → fuera de scope España (EPF/IPF/EUROPEO). */
  tipo: EventType | null;
  /** Zona AEP de dos/tres letras (MAD, CAT…) deducida de la provincia. */
  zona?: string;
  /** Texto literal "OPEN", "MASTERs", etc. */
  divisiones: string;
  /** Modalidad: P / B / M / P-B / B-M. */
  modalidades: string;
  /** R / E / R-E. */
  equipamiento: string;
  /** Si pasa el filtro España (AEP1/2/3 + nombre/sede en España). */
  esEspaña: boolean;
  /** Marcador "pendiente" si la fecha no estaba confirmada. */
  pendiente: boolean;
}

export interface ParsedCalendar {
  /** Año detectado de la cabecera, ej. 2026. */
  year: number;
  entries: ParsedCalendarEntry[];
  warnings: string[];
}
