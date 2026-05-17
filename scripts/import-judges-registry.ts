/**
 * Importa «Copia de Control jueces.xlsx» a Supabase.
 *
 * Uso:
 *   npm run db:import-judges -- "/path/Control jueces.xlsx"
 *   npm run db:import-judges -- "/path/Control jueces.xlsx" --campeonatos "/path/Campeonatos26.csv"
 *   npm run db:import-judges -- "/path/Control jueces.xlsx" --replace
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCampeonatosCsv } from "../src/lib/judges-registry/parse-csv";
import { parseJudgesRegistryXlsx } from "../src/lib/judges-registry";
import { importJudgesRegistryToSupabase } from "../src/server/services/import-judges-registry";

const fileArg = process.argv[2];
const replace = process.argv.includes("--replace");
const csvIdx = process.argv.indexOf("--campeonatos");
const csvArg = csvIdx >= 0 ? process.argv[csvIdx + 1] : undefined;

if (!fileArg) {
  console.error(
    "Uso: npm run db:import-judges -- <ruta.xlsx> [--campeonatos <ruta.csv>] [--replace]",
  );
  process.exit(1);
}

const path = resolve(fileArg);
const buffer = readFileSync(path);
const parsed = parseJudgesRegistryXlsx(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
);

if (csvArg) {
  const csvText = readFileSync(resolve(csvArg), "utf8");
  const fromCsv = parseCampeonatosCsv(csvText);
  parsed.warnings.push(...fromCsv.warnings);
  const byKey = new Map(
    parsed.competitions.map((c) => [`${c.nombre.toLowerCase().trim()}__${c.fecha}`, c]),
  );
  for (const c of fromCsv.competitions) {
    const key = `${c.nombre.toLowerCase().trim()}__${c.fecha}`;
    byKey.set(key, c);
  }
  parsed.competitions = [...byKey.values()];
  console.log(`→ CSV campeonatos: ${fromCsv.competitions.length} filas fusionadas`);
}

console.log(
  `→ ${parsed.referees.length} jueces, ${parsed.competitions.length} campeonatos 2026`,
);
if (replace) console.log("→ Modo replace: borra jueces y campeonatos existentes");

importJudgesRegistryToSupabase(parsed, { replace })
  .then((r) => {
    console.log("\nResultado:");
    console.log(`  Jueces creados:      ${r.refereesCreated}`);
    console.log(`  Jueces actualizados: ${r.refereesUpdated}`);
    console.log(`  Jueces omitidos:     ${r.refereesSkipped}`);
    console.log(`  Campeonatos nuevos:  ${r.competitionsCreated}`);
    console.log(`  Campeonatos dup:     ${r.competitionsSkipped}`);
    if (r.warnings.length) {
      console.log("\nAvisos:");
      for (const w of r.warnings.slice(0, 20)) console.log(`  - ${w}`);
      if (r.warnings.length > 20) {
        console.log(`  … y ${r.warnings.length - 20} más`);
      }
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
