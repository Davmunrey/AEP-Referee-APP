import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tablasVivas } from "./lib/migration-tables.mjs";

// Avisos que NO bloquean la auditoría, cada uno con su motivo. Se revisan
// cuando cambie alguna de las condiciones que los justifican.
//
//  - Los dos primeros son de `xlsx`, que solo se usa para leer el Excel del
//    censo en el servidor, con autenticación, tope de tamaño, tope de entradas
//    del ZIP y tope de filas.
//  - El de vitest es de `@vitest/mocker` (path traversal al redirigir un
//    mock): solo afectan a la ejecución de tests, no se despliega nada de eso,
//    y explotarlo exige control sobre el propio fichero de test. La subida a
//    4.1.11 está bloqueada por un fallo de npm 10.9.7 al resolver los peers de
//    esa versión («Cannot read properties of null (reading 'edgesOut')»);
//    forzarla con --legacy-peer-deps deja el árbol sin `webpack` y rompe el
//    build. Se retiran en cuanto npm resuelva 4.1.11 o salga un parche en la
//    línea 4.1.x que sí instale.
const allowedAdvisories = new Set([
  "GHSA-4r6h-8v6p-xvw6",
  "GHSA-5pgg-2g8v-p4x9",
  "GHSA-82fw-gwwq-j7x9",
]);

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const failures = [];

function fail(id, detail) {
  failures.push({ id, detail });
}

if (packageJson.overrides?.postcss == null) {
  fail("DEP-01", "Falta override postcss >= 8.5.10");
}

// En Windows el binario es `npm.cmd`; `execFileSync` no resuelve PATHEXT (eso es
// cosa del shell), así que invocarlo como "npm" lanza ENOENT. Resolvemos el nombre
// real por plataforma para que la auditoría corra igual en Windows y POSIX.
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

let audit;
try {
  const out = execFileSync(npmBin, ["audit", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  audit = JSON.parse(out);
} catch (error) {
  const stdout = error?.stdout?.toString?.() ?? "";
  audit = stdout ? JSON.parse(stdout) : null;
}

if (!audit) fail("DEP-02", "npm audit no produjo JSON");

for (const vuln of Object.values(audit?.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via === "string") continue;
    const advisoryId = String(via.url ?? via.source).split("/").pop();
    if (!allowedAdvisories.has(advisoryId)) {
      fail("DEP-03", `${vuln.name}: ${via.source} ${via.title}`);
    }
  }
}

const nextConfig = readFileSync("next.config.ts", "utf8");
for (const header of [
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Strict-Transport-Security",
]) {
  if (!nextConfig.includes(header)) fail("HDR-01", `Falta header ${header}`);
}

const pdfExtractor = readFileSync("src/lib/schedule-parser/extract-pdf-text.ts", "utf8");
if (!pdfExtractor.includes("hasPdfSignature")) {
  fail("IMP-01", "Imports PDF sin validación de firma %PDF-");
}

const importSecurity = readFileSync("src/lib/import-security.ts", "utf8");
if (!importSecurity.includes("MAX_SELECTED_KEYS")) {
  fail("IMP-02", "Selección import sin límite centralizado");
}

// ── RLS: nada permisivo para `authenticated` sobre datos de la aplicación ────
// La clave anónima va en el navegador: una política `USING (true)` deja hablar
// con la tabla directamente, saltándose el RBAC de la API. Toda la app entra
// con service_role desde el servidor, así que ninguna tabla con datos o
// historial necesita política para `authenticated`.
//
// Excepción deliberada: `app_sync_state`, lo único que el navegador consulta
// con la clave anónima (poll de versión para el refresco en vivo).
//
// `zones` y `regulation_rules` siguen aquí por su historia: se documentaron
// como lecturas abiertas a propósito por ser datos de referencia sin nada
// personal, pero hoy no tienen ninguna política, así que están cerradas como el
// resto y nada las lee desde el navegador. Se conservan en la lista para que
// volver a abrirlas —si algún día el navegador las necesitara— no exija además
// tocar esta auditoría, no porque estén abiertas ahora.
const RLS_TABLAS_ABIERTAS_OK = new Set(["zones", "regulation_rules", "app_sync_state"]);

const migrationsDir = "supabase/migrations";
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const sqlPorFichero = migrationFiles.map((f) => readFileSync(join(migrationsDir, f), "utf8"));
const sqlTodo = sqlPorFichero.join("\n");

const sinComentariosSql = (sql) =>
  sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

const politicasPermisivas = [];
for (const sql of sqlPorFichero) {
  const sinComentarios = sinComentariosSql(sql);
  const re = /CREATE\s+POLICY\s+"?([A-Za-z0-9_]+)"?\s+ON\s+(?:public\.)?([A-Za-z0-9_]+)([\s\S]*?);/gi;
  let m;
  while ((m = re.exec(sinComentarios)) !== null) {
    const [, nombre, tabla, cuerpo] = m;
    if (!/TO\s+authenticated/i.test(cuerpo)) continue;
    if (!/USING\s*\(\s*true\s*\)/i.test(cuerpo)) continue;
    politicasPermisivas.push({ nombre, tabla });
  }
}

// Una migración puede retirar las políticas de una tabla SIN nombrarlas, con un
// barrido sobre pg_policies. Es la forma fuerte: la 037 pasó a ella justamente
// porque producción tiene nombres que no son los del repositorio, y un DROP por
// nombre que no encuentra nada deja la tabla abierta informando de éxito.
//
// Se reconoce el barrido por su SQL, no por un comentario: hace falta el DROP
// dinámico Y la lista de tablas del FOREACH. Si falta cualquiera de los dos no
// se da por retirada ninguna política, que es como debe fallar esto.
const tablasBarridas = new Set();
for (const sql of sqlPorFichero) {
  const sinComentarios = sinComentariosSql(sql);
  if (!/EXECUTE\s+format\(\s*'DROP\s+POLICY\s+%I\s+ON\s+public\.%I'/i.test(sinComentarios)) {
    continue;
  }
  const lista = sinComentarios.match(/FOREACH\s+\w+\s+IN\s+ARRAY\s+ARRAY\[([\s\S]*?)\]/i);
  if (!lista) continue;
  for (const [, tabla] of lista[1].matchAll(/'([A-Za-z0-9_]+)'/g)) {
    tablasBarridas.add(tabla);
  }
}

for (const { nombre, tabla } of politicasPermisivas) {
  if (RLS_TABLAS_ABIERTAS_OK.has(tabla)) continue;
  if (tablasBarridas.has(tabla)) continue;
  const dropped = new RegExp(
    `DROP\\s+POLICY\\s+(?:IF\\s+EXISTS\\s+)?"?${nombre}"?\\s+ON`,
    "i",
  ).test(sqlTodo);
  if (!dropped) {
    fail("RLS-01", `${tabla}: política permisiva «${nombre}» para authenticated sin retirar`);
  }
}

// ── RLS-02: toda tabla que crean las migraciones acaba con RLS activada ─────
// La clave anónima va en el navegador, así que una tabla sin RLS es una tabla
// pública. Hoy las 23 la tienen, pero eso era una coincidencia afortunada: nada
// lo exigía, y la que se olvidara no lo diría en ninguna parte —quedaría
// legible, y según los privilegios por defecto de Supabase también escribible,
// sin un solo error en los logs—.
//
// Se compara contra el conjunto FINAL de tablas: las que una migración
// posterior borra no cuentan (device_tokens muere en la 028,
// referee_availability en la 019).
const tablasConRls = new Set();
for (const sql of sqlPorFichero) {
  const limpio = sinComentariosSql(sql);
  for (const [, t] of limpio.matchAll(
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([A-Za-z0-9_]+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi,
  )) {
    tablasConRls.add(t);
  }
}
// Activarla con SQL dinámico también vale, siempre que la tabla salga de una
// lista escrita en el fichero: es lo que hace la 037 y es más robusto que
// nombrarlas una a una.
if (/EXECUTE\s+format\(\s*'ALTER\s+TABLE\s+public\.%I\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY'/i.test(
  sqlPorFichero.map(sinComentariosSql).join("\n"),
)) {
  for (const t of tablasBarridas) tablasConRls.add(t);
}
for (const tabla of tablasVivas(sqlPorFichero)) {
  if (tablasConRls.has(tabla)) continue;
  fail("RLS-02", `${tabla}: se crea sin ENABLE ROW LEVEL SECURITY en ninguna migración`);
}

if (failures.length) {
  console.error("Security audit: FAIL");
  for (const f of failures) console.error(`- ${f.id}: ${f.detail}`);
  process.exit(1);
}

console.log("Security audit: OK");
console.log("Allowed advisories: xlsx server-side import only, mitigated by auth, size, ZIP and row limits");
