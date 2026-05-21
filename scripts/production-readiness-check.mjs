import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

function walk(dir, predicate = () => true) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function exists(path) {
  return existsSync(join(root, path));
}

const failures = [];
const warnings = [];

function fail(id, detail) {
  failures.push({ id, detail });
}

function warn(id, detail) {
  warnings.push({ id, detail });
}

const packageJson = JSON.parse(read("package.json"));
for (const script of ["lint", "test", "build"]) {
  if (!packageJson.scripts?.[script]) fail("PKG-01", `Falta script npm: ${script}`);
}
for (const script of ["audit:prod", "audit:security", "verify", "e2e"]) {
  if (!packageJson.scripts?.[script]) fail("PKG-02", `Falta script npm: ${script}`);
}

const apiRoutes = walk(join(root, "src/app/api/v1"), (file) => file.endsWith("route.ts"));
const publicApi = new Set([
  "src/app/api/v1/auth/login/route.ts",
  "src/app/api/v1/auth/logout/route.ts",
  "src/app/api/v1/auth/signout/route.ts",
]);

for (const file of apiRoutes) {
  const rel = relative(root, file);
  const src = readFileSync(file, "utf8");
  if (!publicApi.has(rel) && !/requireApiUser|getSession/.test(src)) {
    fail("API-01", `${rel} no exige sesión`);
  }

  const mutates = /export async function (POST|PUT|PATCH|DELETE)\b/.test(src);
  const hasAuthz =
    /can(EditRoster|Manage|Approve|Admin|Review)|canManageSanctions|user\.role|checkRefereeScope/.test(
      src,
    );
  if (mutates && !publicApi.has(rel) && !hasAuthz) {
    fail("API-02", `${rel} muta datos sin guard RBAC explícito`);
  }
}

const importRoutes = [
  "src/app/api/v1/calendar/import/route.ts",
  "src/app/api/v1/competitions/[id]/roster/assignments/import/route.ts",
  "src/app/api/v1/competitions/[id]/roster/template/import/route.ts",
  "src/app/api/v1/referees/import/route.ts",
];

for (const route of importRoutes) {
  if (!exists(route)) {
    fail("IMP-01", `${route} no existe`);
    continue;
  }
  const src = read(route);
  if (!src.includes("apply")) fail("IMP-02", `${route} no separa preview/apply`);
  if (!/preview/i.test(src)) fail("IMP-03", `${route} no devuelve preview`);
}

for (const route of importRoutes.slice(0, 3)) {
  const src = read(route);
  if (!src.includes("selectedKeys")) {
    fail("IMP-04", `${route} no permite selección granular`);
  }
}

for (const doc of [
  "docs/ARCHITECTURE.md",
  "docs/AUTH.md",
  "docs/DATABASE.md",
  "docs/DEPLOY.md",
  "docs/GUIA-USO.md",
  "docs/AUDIT.md",
  "docs/PRODUCTION-READINESS.md",
]) {
  if (!exists(doc)) fail("DOC-01", `${doc} no existe`);
}

if (!exists("supabase/migrations/003_supabase_auth.sql")) {
  fail("DB-01", "Falta migración base auth/RLS");
}
if (!exists("supabase/migrations/007_rls_hardening.sql")) {
  fail("DB-02", "Falta hardening RLS deny-by-default");
}
if (!exists("supabase/migrations/016_competition_column_rename.sql")) {
  fail("DB-03", "Falta migración legacy event_id -> competition_id");
}

const visibleFiles = walk(join(root, "src"), (file) => /\.(tsx|ts)$/.test(file));
for (const file of visibleFiles) {
  const rel = relative(root, file);
  const src = readFileSync(file, "utf8");
  if (/\(Excel:/i.test(src)) fail("UX-01", `${rel} expone fuente Excel en UI`);
  const visibleLegacy = src
    .split(/\r?\n/)
    .filter((line) => /(?:>|["'`])[^<"'`]*(?:Evento|evento)[^<"'`]*(?:<|["'`])/.test(line))
    .filter((line) => !/useState|setEvento|editEvento|item\.evento|report\.evento|referee\.eventos|eventosCompletados/.test(line));
  if (visibleLegacy?.length && rel.includes("components/")) {
    warn("UX-02", `${rel} contiene literal visible legado: ${visibleLegacy[0].trim()}`);
  }
}

if (!exists("tests/session-rbac.test.ts")) fail("TEST-01", "Falta test RBAC sesión");
if (!exists("tests/quadrant-parser.test.ts")) fail("TEST-02", "Falta test parser cuadrantes");
if (!exists("tests/calendar-parser.test.ts")) fail("TEST-03", "Falta test parser calendario");

if (warnings.length) {
  console.log("Avisos:");
  for (const item of warnings) console.log(`- ${item.id}: ${item.detail}`);
}

if (failures.length) {
  console.error("Production readiness: FAIL");
  for (const item of failures) console.error(`- ${item.id}: ${item.detail}`);
  process.exit(1);
}

console.log("Production readiness: OK");
console.log(`API routes checked: ${apiRoutes.length}`);
console.log(`Import routes checked: ${importRoutes.length}`);
