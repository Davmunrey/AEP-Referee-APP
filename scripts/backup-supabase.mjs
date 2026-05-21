import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const mode = process.argv[2] ?? "create";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const backupDir = join(process.cwd(), "backups");

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
  for (const [index, table] of tables.entries()) {
    const rows = await fetchAll(client, table);
    if (index > 0) stream.write(",");
    stream.write(`${JSON.stringify(table)}:${JSON.stringify(rows)}`);
    console.log(`${table}: ${rows.length}`);
  }
  stream.write("}}\n");
  stream.end();
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  console.log(`Backup creado: ${output}`);
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
}

try {
  if (mode === "create") await createBackup();
  else if (mode === "verify") verifyBackup();
  else throw new Error("Uso: backup-supabase.mjs [create|verify] [backup.json]");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
