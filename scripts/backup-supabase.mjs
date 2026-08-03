import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const mode = process.argv[2] ?? "create";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const backupDir = join(process.cwd(), "backups");

// Tablas que DEBEN existir: si falta alguna, la copia falla. Son las que ya
// estaban en producción cuando se escribió este script, más las que se han
// confirmado después.
const tables = [
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

// Tablas que se copian SI existen. Aquí viven las de migraciones que aún pueden
// estar sin aplicar: si fueran obligatorias, la copia nocturna entera fallaría
// por una migración pendiente, que es peor que la laguna que vienen a tapar.
//
// La lista había divergido once migraciones: la compensación económica de los
// jueces —importes, dietas, kilometraje— NO se estaba respaldando en absoluto.
const optionalTables = [
  "judge_compensation_claims", // 024
  "judge_compensation_duty_lines", // 024
  "competition_availability", // 019
  "app_sync_state", // 029
  "approval_proposals_duplicadas_034", // 034: propuestas apartadas por el índice único
  "support_tickets", // 035
  "support_ticket_comments", // 035
  "support_ticket_attachments", // 035
];

function requireEnv() {
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL no configurada");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
}

function latestBackupPath() {
  if (!existsSync(backupDir)) throw new Error("No existe carpeta backups");
  const files = readdirSync(backupDir)
    .filter((file) => /^aep-backup-\d{4}-\d{2}-\d{2}T.*\.json$/.test(file))
    .sort();
  if (!files.length) throw new Error("No hay backups");
  return join(backupDir, files.at(-1));
}

async function fetchAll(client, table) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await client.from(table).select("*").range(from, to);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function createBackup() {
  requireEnv();
  mkdirSync(backupDir, { recursive: true });
  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const createdAt = new Date().toISOString();
  const output = join(backupDir, `aep-backup-${createdAt.replace(/[:.]/g, "-")}.json`);
  const stream = createWriteStream(output, { encoding: "utf8", flags: "wx" });

  stream.write(`{"createdAt":${JSON.stringify(createdAt)},"tables":{`);
  let escritas = 0;
  for (const table of tables) {
    const rows = await fetchAll(client, table);
    if (escritas > 0) stream.write(",");
    stream.write(`${JSON.stringify(table)}:${JSON.stringify(rows)}`);
    escritas += 1;
    console.log(`${table}: ${rows.length}`);
  }
  const ausentes = [];
  for (const table of optionalTables) {
    let rows;
    try {
      rows = await fetchAll(client, table);
    } catch {
      // Migración aún sin aplicar: se anota y se sigue.
      ausentes.push(table);
      continue;
    }
    if (escritas > 0) stream.write(",");
    stream.write(`${JSON.stringify(table)}:${JSON.stringify(rows)}`);
    escritas += 1;
    console.log(`${table}: ${rows.length}`);
  }
  stream.write("}}\n");
  stream.end();
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  if (ausentes.length) {
    console.warn(
      `Aviso: sin copiar (migración pendiente): ${ausentes.join(", ")}`,
    );
  }
  console.log(`Backup creado: ${output} (${escritas} tablas)`);
}

function verifyBackup() {
  const file = process.argv[3] ?? latestBackupPath();
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  if (!parsed.createdAt || typeof parsed.createdAt !== "string") {
    throw new Error("Backup sin createdAt");
  }
  if (!parsed.tables || typeof parsed.tables !== "object") {
    throw new Error("Backup sin tables");
  }
  const missing = tables.filter((table) => !Array.isArray(parsed.tables[table]));
  if (missing.length) throw new Error(`Backup incompleto: ${missing.join(", ")}`);

  console.log(`Backup válido: ${file}`);
  for (const table of tables) console.log(`${table}: ${parsed.tables[table].length}`);
  for (const table of optionalTables) {
    const rows = parsed.tables[table];
    console.log(
      Array.isArray(rows) ? `${table}: ${rows.length}` : `${table}: ausente (migración pendiente)`,
    );
  }
}

async function restoreDryRun() {
  requireEnv();
  const file = process.argv[3] ?? latestBackupPath();
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const missing = tables.filter((table) => !Array.isArray(parsed.tables?.[table]));
  if (missing.length) throw new Error(`Backup incompleto: ${missing.join(", ")}`);

  console.log(`Restore dry-run: ${file}`);
  for (const table of tables) {
    const rows = parsed.tables[table];
    const { error } = await client.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    const sample = rows[0];
    if (sample && (typeof sample !== "object" || Array.isArray(sample))) {
      throw new Error(`${table}: filas inválidas`);
    }
    console.log(`${table}: ${rows.length} filas listas`);
  }
  for (const table of optionalTables) {
    const rows = parsed.tables[table];
    if (!Array.isArray(rows)) continue;
    const { error } = await client.from(table).select("*", { count: "exact", head: true });
    if (error) {
      // La copia la tiene pero la base ya no: se avisa, no se aborta el ensayo.
      console.warn(`${table}: en la copia pero no en la base (${error.message})`);
      continue;
    }
    const sample = rows[0];
    if (sample && (typeof sample !== "object" || Array.isArray(sample))) {
      throw new Error(`${table}: filas inválidas`);
    }
    console.log(`${table}: ${rows.length} filas listas`);
  }
  console.log("Restore dry-run OK. No se modificó la BD.");
}

try {
  if (mode === "create") await createBackup();
  else if (mode === "verify") verifyBackup();
  else if (mode === "restore-dry-run") await restoreDryRun();
  else throw new Error("Uso: backup-supabase.mjs [create|verify|restore-dry-run] [backup.json]");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
