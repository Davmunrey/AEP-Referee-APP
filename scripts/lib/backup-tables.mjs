import { tablasVivas } from "./migration-tables.mjs";

// Tablas que DEBEN existir: si falta alguna, la copia falla. Son las que ya
// estaban en producción cuando se escribió este script, más las que se han
// confirmado después.
export const requiredTables = [
  "profiles",
  "zones",
  "referees",
  "competitions",
  "roster_assignments",
  "approval_proposals",
  "promotion_requests",
  "activity_log",
  "roster_history",
  "regulation_rules",
  "app_config",
  "health_snapshots",
  "referee_exams",
  "referee_reports",
  "referee_sanctions",
];

// Tablas que se copian SI existen: todas las demás que las migraciones dejan
// vivas, leídas del propio SQL.
//
// Antes era una lista escrita a mano y envejecía en silencio. Divergió dos
// veces: primero dejó fuera la compensación económica (once migraciones) y
// después las convocatorias, las inscripciones, las respuestas a las
// designaciones y los avisos (042 y 043). Derivada del SQL, una tabla nueva
// entra en la copia el mismo día que su migración.
//
// Son opcionales y no obligatorias porque una migración puede estar aún sin
// aplicar: si lo fueran, la copia nocturna entera fallaría por eso.
export const optionalTables = tablasVivas().filter((t) => !requiredTables.includes(t));
