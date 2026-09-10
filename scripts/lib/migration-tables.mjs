// Tablas que las migraciones dejan vivas en `public`, leídas del propio SQL.
//
// Existe para que las comprobaciones no lleven una lista escrita a mano que
// envejece en silencio: la sonda de lectura anónima de
// `supabase-readiness-audit.mjs` miraba cuatro tablas de veintitrés, y las que
// no miraba —entre ellas las de tickets, que guardan conversaciones de soporte
// en texto libre— podían quedar abiertas sin que nada lo dijera.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CREA = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([A-Za-z0-9_]+)"?/gi;
const BORRA = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([A-Za-z0-9_]+)"?/gi;

/** Quita los comentarios de línea para no leer SQL citado en una explicación. */
export function sinComentariosSql(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

export function leerMigraciones(dir = "supabase/migrations") {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"));
}

/**
 * Conjunto FINAL de tablas: las creadas menos las que una migración posterior
 * borra (device_tokens muere en la 028, referee_availability en la 019).
 * Solo mira `public`: los esquemas `auth` y `storage` son de Supabase.
 */
export function tablasVivas(sqlPorFichero = leerMigraciones()) {
  const creadas = new Set();
  const borradas = new Set();
  for (const sql of sqlPorFichero) {
    const limpio = sinComentariosSql(sql);
    for (const [, t] of limpio.matchAll(CREA)) creadas.add(t);
    for (const [, t] of limpio.matchAll(BORRA)) borradas.add(t);
  }
  for (const t of borradas) creadas.delete(t);
  return [...creadas].sort();
}
