import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * El arreglo en `ensureProfile` (src/lib/auth/session.ts) no bastaba: hay un
 * trigger `handle_new_user` en la base de datos que hace lo mismo en SQL y se
 * dispara al insertar en `auth.users`, antes de que la aplicación llegue a
 * mirar nada. Si el trigger sigue leyendo `raw_user_meta_data->>'invited'`, la
 * puerta sigue abierta por mucho que TypeScript ya no la use.
 *
 * Esta prueba mira la ÚLTIMA definición de la función en el directorio de
 * migraciones —la que quedará viva— para que nadie la reintroduzca sin darse
 * cuenta en una migración posterior.
 */

const DIR = join(process.cwd(), "supabase", "migrations");
const FIRMA = "CREATE OR REPLACE FUNCTION public.handle_new_user";

function ultimaDefinicion(): { fichero: string; sql: string } {
  const conLaFuncion = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((fichero) => ({ fichero, sql: readFileSync(join(DIR, fichero), "utf8") }))
    .filter(({ sql }) => sql.includes(FIRMA));
  const ultima = conLaFuncion.at(-1);
  if (!ultima) throw new Error(`Ninguna migración define ${FIRMA}`);
  return ultima;
}

/** El cuerpo de la función, sin los comentarios `--` que la rodean. */
function cuerpoSinComentarios(sql: string): string {
  const desde = sql.indexOf(FIRMA);
  return sql
    .slice(desde)
    .split("\n")
    .map((linea) => linea.replace(/--.*$/, ""))
    .join("\n");
}

describe("el trigger de alta de usuario no confía en metadata del usuario", () => {
  it("la última definición de handle_new_user no lee `invited`", () => {
    const { fichero, sql } = ultimaDefinicion();
    const cuerpo = cuerpoSinComentarios(sql);
    expect(cuerpo, `${fichero} vuelve a leer la bandera del propio usuario`).not.toMatch(
      /raw_user_meta_data\s*->>\s*'invited'/,
    );
    expect(cuerpo).not.toMatch(/\bis_invited\b/);
  });

  it("solo el primer perfil de la instalación nace activo", () => {
    const cuerpo = cuerpoSinComentarios(ultimaDefinicion().sql);
    expect(cuerpo).toMatch(/CASE\s+WHEN\s+is_first\s+THEN\s+true\s+ELSE\s+false\s+END/);
  });

  it("sigue siendo SECURITY DEFINER con search_path fijado y sin permisos públicos", () => {
    // Un SECURITY DEFINER sin `search_path` fijo es escalable desde un esquema
    // que el llamante controle; y la función no debe poder invocarse suelta.
    const { sql } = ultimaDefinicion();
    const cuerpo = cuerpoSinComentarios(sql);
    expect(cuerpo).toMatch(/SECURITY DEFINER/);
    expect(cuerpo).toMatch(/SET search_path\s*=/);
    expect(cuerpo).toMatch(/REVOKE ALL ON FUNCTION public\.handle_new_user\(\)/);
  });
});
