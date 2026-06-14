import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowedAdvisories = new Set([
  "GHSA-4r6h-8v6p-xvw6",
  "GHSA-5pgg-2g8v-p4x9",
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

if (failures.length) {
  console.error("Security audit: FAIL");
  for (const f of failures) console.error(`- ${f.id}: ${f.detail}`);
  process.exit(1);
}

console.log("Security audit: OK");
console.log("Allowed advisories: xlsx server-side import only, mitigated by auth, size, ZIP and row limits");
