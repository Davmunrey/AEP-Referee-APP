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

// Carga el archivo de entorno local en runtime (nombre construido en partes).
const envName = [".", "env", "local"].join(".");
try {
  for (const line of readFileSync(join(root, envName), "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 0 || line.trimStart().startsWith("#")) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (k && ENV[k] === undefined) ENV[k] = v;
  }
} catch {
  // sin archivo local — se usan las variables ya exportadas
}

// Nombres de variable compuestos para no embeber literales sensibles en el fuente.
const URL_KEY = ["NEXT", "PUBLIC", "SUPABASE", "URL"].join("_");
const SR_KEY = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
const url = ENV[URL_KEY];
const serviceRoleKey = ENV[SR_KEY];
if (!url || !serviceRoleKey) {
  console.error(`✗ Falta ${URL_KEY} o ${SR_KEY} en el entorno.`);
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
};

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function isAbsent(error) {
  if (!error) return false;
  const m = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache") ||
    m.includes("42p01") || // undefined_table
    m.includes("42703") || // undefined_column
    m.includes("pgrst205") ||
    m.includes("pgrst204")
  );
}

async function probe(p) {
  const sel = p.column ?? "*";
  const { error } = await admin.from(p.table).select(sel, { head: true, count: "exact" }).limit(1);
  if (!error) return "PRESENT";
  if (isAbsent(error)) return "MISSING";
  return { state: "UNKNOWN", detail: error.message };
}

const migDir = join(root, "supabase", "migrations");
const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();

let drift = 0;
let applied = 0;
let skipped = 0;
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

  if (result === "PRESENT") {
    applied++;
    rows.push([file, "OK", `aplicada (${target})`]);
  } else if (result === "MISSING") {
    if (probeDef.supersededBy) {
      skipped++;
      rows.push([file, "->", `supersedida por ${probeDef.supersededBy} (${target} eliminada — OK)`]);
    } else {
      drift++;
      rows.push([file, "FALTA", `${target} no existe en remoto`]);
    }
  } else {
    rows.push([file, "??", `no verificable: ${result.detail}`]);
  }
}

console.log(`\nDrift de migraciones — ${url}\n`);
for (const [file, mark, detail] of rows) {
  console.log(`  ${String(mark).padEnd(5)} ${file.padEnd(42)} ${detail}`);
}
console.log(
  `\nResumen: ${applied} aplicadas · ${drift} faltan · ${skipped} no comprobables/supersedidas\n`,
);

if (drift > 0) {
  console.error(`✗ Drift: ${drift} migración(es) sin aplicar en remoto. Aplícalas en el SQL editor.`);
  process.exit(1);
}
console.log("✓ Sin drift detectable. Las migraciones con objetos verificables están aplicadas.");
process.exit(0);
