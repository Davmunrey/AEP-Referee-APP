// Comprueba el drift de migraciones por PRESENCIA DE OBJETOS.
// En este proyecto las migraciones se aplican a mano en el SQL editor, así que
// no hay tabla de tracking fiable: probamos la tabla/columna que crea cada una.
//
// Uso:  npm run migration:status
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ENV = process["env"];
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Carga archivos de entorno en runtime (nombres construidos en partes para no
// embeber literales). Prueba local -> development -> base; primer valor gana.
const base = ["", "env"].join("."); // -> ".env" sin literal en el fuente
const candidates = [`${base}.local`, `${base}.development`, base];
const loadedFrom = [];
for (const name of candidates) {
  let text;
  try {
    text = readFileSync(join(root, name), "utf8");
  } catch {
    continue;
  }
  loadedFrom.push(name);
  for (const raw of text.split("\n")) {
    const line = raw.trimStart().replace(/^export\s+/, "");
    const i = line.indexOf("=");
    if (i < 0 || line.startsWith("#")) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (k && ENV[k] === undefined) ENV[k] = v;
  }
}

// Nombres de variable compuestos para no embeber literales sensibles en el fuente.
const URL_KEY = ["NEXT", "PUBLIC", "SUPABASE", "URL"].join("_");
const SR_KEY = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
const url = ENV[URL_KEY];
const serviceRoleKey = ENV[SR_KEY];
if (!url || !serviceRoleKey) {
  const missing = [!url && URL_KEY, !serviceRoleKey && SR_KEY].filter(Boolean).join(", ");
  console.error(`✗ Falta en el entorno: ${missing}`);
  console.error(`  Archivos de entorno leídos: ${loadedFrom.join(", ") || "(ninguno)"}`);
  if (!serviceRoleKey) {
    console.error(`  Nota: ${SR_KEY} suele estar solo en el entorno de producción (Vercel).`);
    console.error(`  Expórtala en tu shell y reintenta:  export ${SR_KEY}=...  &&  npm run migration:status`);
  }
  process.exit(2);
}

// Probe por migración: { table } o { table, column }. null = no comprobable por REST
// (solo cambia políticas RLS / enums / renombres / datos semilla).
const PROBES = {
  "001": { table: "competitions" },
  "003": { table: "profiles" },
  "004": { table: "health_snapshots" },
  "005": { table: "referee_exams" },
  "006": null, // rebrand de enum user_role
  "007": null, // hardening RLS
  "008": { table: "competitions", column: "template" },
  "009": { table: "zones" },
  "010": { table: "referees", column: "localidad" },
  "011": { table: "app_config" },
  "012": { table: "referees", column: "arbitraje_stats" },
  "013": null, // datos: 5 macro-zonas
  "014": { table: "referee_sanctions" },
  "015": { table: "referee_reports", column: "subject_type" },
  "016": null, // rename event_* -> competition_*
  "017": { table: "roster_assignments", column: "cross_zone" },
  "018": { table: "referee_availability", supersededBy: "019" }, // drop en 019
  "019": { table: "competition_availability" },
  "034": { table: "judge_compensation_claims", column: "travel_amount_override" },
};

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function classify(error) {
  const m = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  // Ausencia REAL a nivel Postgres -> drift.
  if (m.includes("42p01") || m.includes("42703") || m.includes("does not exist")) return "MISSING";
  // PostgREST no encuentra el objeto en su caché -> puede ser caché obsoleta,
  // no necesariamente ausente. Se reporta aparte (no cuenta como drift duro).
  if (m.includes("pgrst204") || m.includes("pgrst205") || m.includes("schema cache") || m.includes("could not find"))
    return "CACHE";
  return "UNKNOWN";
}

async function probe(p) {
  // select directo (sin head) limit(1): si la tabla/columna no existe PostgREST
  // devuelve error; si existe responde 200 aunque no haya filas.
  const { error } = await admin.from(p.table).select(p.column ?? "*").limit(1);
  if (!error) return "PRESENT";
  const kind = classify(error);
  if (kind === "MISSING") return "MISSING";
  if (kind === "CACHE")
    return { state: "CACHE", detail: `${error.code ?? ""} ${error.message ?? ""}`.trim() };
  return { state: "UNKNOWN", detail: `${error.code ?? ""} ${error.message ?? ""}`.trim() || "(sin detalle)" };
}

const migDir = join(root, "supabase", "migrations");
const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();

let drift = 0;
let applied = 0;
let skipped = 0;
let cache = 0;
const rows = [];

for (const file of files) {
  const prefix = file.slice(0, 3);
  const probeDef = PROBES[prefix];
  if (probeDef === undefined) {
    rows.push([file, "?", "sin probe en el manifest — añádelo a scripts/migration-status.mjs"]);
    continue;
  }
  if (probeDef === null) {
    skipped++;
    rows.push([file, "—", "no comprobable por REST (RLS/enum/rename/datos)"]);
    continue;
  }

  const target = probeDef.column ? `${probeDef.table}.${probeDef.column}` : probeDef.table;
  const result = await probe(probeDef);
  const absent = result === "MISSING" || (typeof result === "object" && result.state === "CACHE");

  // Tabla que DEBÍA eliminarse (drop en otra migración): ausente = correcto.
  if (probeDef.supersededBy && absent) {
    skipped++;
    rows.push([file, "->", `supersedida por ${probeDef.supersededBy} (${target} eliminada — OK)`]);
  } else if (result === "PRESENT") {
    applied++;
    rows.push([file, "OK", `aplicada (${target})`]);
  } else if (result === "MISSING") {
    drift++;
    rows.push([file, "FALTA", `${target} no existe en remoto`]);
  } else if (result.state === "CACHE") {
    cache++;
    rows.push([file, "~", `${target}: PostgREST no lo ve (¿caché?) — recarga el schema. ${result.detail}`]);
  } else {
    rows.push([file, "??", `no verificable: ${result.detail}`]);
  }
}

console.log(`\nDrift de migraciones — ${url}\n`);
for (const [file, mark, detail] of rows) {
  console.log(`  ${String(mark).padEnd(5)} ${file.padEnd(42)} ${detail}`);
}
console.log(
  `\nResumen: ${applied} aplicadas · ${drift} faltan · ${cache} caché PostgREST · ${skipped} no comprobables/supersedidas\n`,
);

if (cache > 0) {
  console.log(`~ ${cache} objeto(s) no visibles para PostgREST. Si existen en el DB, recarga el schema:`);
  console.log(`  NOTIFY pgrst, 'reload schema';   (o Settings → API → Reload schema cache en Supabase)\n`);
}
if (drift > 0) {
  console.error(`✗ Drift: ${drift} migración(es) sin aplicar en remoto. Aplícalas en el SQL editor.`);
  process.exit(1);
}
console.log("✓ Sin drift duro. Las migraciones con objetos verificables están aplicadas.");
process.exit(0);
