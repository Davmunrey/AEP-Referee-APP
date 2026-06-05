/**
 * Exporta el reglamento técnico IPF (fuente única: src/lib/ipf-chapters.ts) a
 * JSON para empaquetarlo en la app iOS (Resources/ipf-rulebook.json). Reejecuta
 * este script cuando cambie el reglamento para mantener iOS sincronizado:
 *   npx tsx scripts/export-ipf-rulebook.ts
 */
import { writeFileSync } from "node:fs";
import { IPF_CHAPTERS } from "../src/lib/ipf-chapters";

const out = "apps/ios/AEPTarima/Resources/ipf-rulebook.json";
writeFileSync(out, JSON.stringify(IPF_CHAPTERS, null, 2) + "\n", "utf8");
const articles = IPF_CHAPTERS.reduce((n, c) => n + c.articles.length, 0);
console.log(`Escrito ${out}: ${IPF_CHAPTERS.length} capítulos, ${articles} artículos.`);
