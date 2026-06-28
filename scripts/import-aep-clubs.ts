/**
 * Importa el listado oficial de clubes AEP desde el PDF publicado en powerliftingspain.es
 * y genera src/lib/aep-clubs-registry.json.
 *
 *   npx tsx scripts/import-aep-clubs.ts
 */
import { writeFileSync } from "node:fs";
import pdf from "pdf-parse";

const PDF_URL =
  "https://powerliftingspain.es/wp-content/uploads/2026/04/CLUBES-Y-DATOS-HISTORICOS.xlsx-DATOS-DE-CONTACTO-DE-CLUBES.pdf";

const REGION_RE = /^([A-ZÁÉÍÓÚÑ0-9\s\-]+):\s*(\d+)\s*$/;
const SKIP_RE = /^(Página|Provincia|Ningún|ASOCIACIÓN|Clubes por|Actualizado|\*)/;

const EMAIL_HINTS = [
  "power",
  "club",
  "lift",
  "strength",
  "barbell",
  "gym",
  "info",
  "mail",
  "team",
  "coach",
  "contact",
  "secretaria",
  "afiliac",
  "haltero",
  "fuerza",
  "iron",
  "raw",
  "atp",
  "cd",
  "a.a.",
  "work",
  "south",
  "north",
  "elite",
  "gr8",
  "720",
  "84",
];

export interface AepClubRecord {
  region: string;
  province: string;
  locality: string;
  name: string;
  responsible: string;
  email: string;
}

function scoreEmailLocal(local: string): number {
  const lower = local.toLowerCase();
  if (!/^[a-z0-9._+-]+$/i.test(local)) return -100;
  if (local.length < 5 || local.length > 50) return -50;

  let score = 10;
  const badPrefixes = [
    "ndez",
    "nguez",
    "guez",
    "rra",
    "llor",
    "herrad",
    "llorent",
    "renedo",
    "heredia",
    "fernand",
    "martine",
    "gutier",
    "rodrigu",
    "castill",
    "moriana",
    "pascual",
    "ramirez",
    "gomez",
    "perez",
    "sanchez",
    "lopez",
    "garcia",
    "mora",
    "nez",
    "rez",
  ];
  for (const bad of badPrefixes) {
    if (lower.startsWith(bad)) score -= 25;
  }

  for (const hint of EMAIL_HINTS) {
    if (lower.includes(hint)) score += 5;
  }
  if (/^(info|club|secretaria|contact|powerlifting|power|cd|haltero|dhernandez|aragonbarbell|zbbarbell|antoni-10-23|rafael@|info@home)/.test(lower)) {
    score += 15;
  }
  if (/^ilinfo/.test(lower)) score -= 20;
  if (/^doinfo/.test(lower)) score -= 20;
  if (/^-10-23/.test(lower)) score -= 20;
  if (local.includes(".")) score += 2;
  if (/\d/.test(local)) score += 1;
  score -= local.length * 0.15;
  return score;
}

function extractEmail(line: string): { email: string; beforeEmail: string } | null {
  const at = line.lastIndexOf("@");
  if (at === -1) return null;

  let end = line.length;
  while (end > at && !/[a-zA-Z]/.test(line[end - 1]!)) end--;

  let i = at - 1;
  while (i >= 0 && /[a-zA-Z0-9._+-]/.test(line[i]!)) i--;
  i++;

  const rawLocal = line.slice(i, at);
  let bestStart = i;
  let bestScore = -1;

  for (let j = 0; j < rawLocal.length; j++) {
    const local = rawLocal.slice(j);
    if (!/^[a-zA-Z0-9._+-]+$/.test(local) || local.length < 6) continue;
    const lower = local.toLowerCase();
    const looksLikeEmail =
      /\d/.test(local) ||
      local.includes(".") ||
      EMAIL_HINTS.some((h) => lower.includes(h));
    if (!looksLikeEmail) continue;
    const score = scoreEmailLocal(local);
    if (score > bestScore) {
      bestScore = score;
      bestStart = i + j;
    }
  }

  const email = line.slice(bestStart, end).toLowerCase();
  if (!/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(email)) return null;

  return { email, beforeEmail: line.slice(0, bestStart) };
}

const PROVINCES = [
  "Las Palmas",
  "Santa Cruz de Tenerife",
  "La Coruña",
  "Ciudad Real",
  "Castilla-La Mancha",
  "Roquetas de Mar",
  "Jerez de la Frontera",
  "Alhaurín De La Torre",
  "Alcalá de Guadaíra",
  "Bollullos de la Mitación",
  "Villanueva del Río y Minas",
  "Santiago de Compostela",
  "Las Torres de Cotillas",
  "San Vicente del Raspeig",
  "Puerto de Sagunto",
  "Palma de Mallorca",
  "Santa Gertrudis de Fruitera",
  "Costa de la Calma",
  "Campos, Mallorca",
  "Porto Cristo",
  "Sa Pobla",
  "Las Palmas de Gran Canarias",
  "El Sobradillo",
  "La Laguna",
  "Trobajo del Camino",
  "Burguillos de Toledo",
  "Caldas de Reis",
  "Aldea del Fresno",
  "Alcalá de Henares",
  "Colmenar Viejo",
  "El Berruco",
  "El Vellón",
  "Las Rozas de Madrid",
  "Mejorada del Campo",
  "Miraflores de la Sierra",
  "Rivas Vaciamadrid",
  "Torrejón de Ardoz",
  "Malgrat de Mar",
  "Palau Solita I Plegamans",
  "Sant Adrià del Besos",
  "Sant Boi de Llobregat",
  "Vilafranca del Penedès",
  "La Pobla de Mafumet",
  "El Vendrell",
  "Castilla y LEÓN",
  "Almeria",
  "Almería",
  "Cadíz",
  "Cádiz",
  "Córdoba",
  "Granada",
  "Huelva",
  "Jaén",
  "Málaga",
  "Sevilla",
  "Huesca",
  "Zaragoza",
  "Asturias",
  "Baleares",
  "Tenerife",
  "Cantabria",
  "Albacete",
  "Cuenca",
  "Toledo",
  "Ávila",
  "Burgos",
  "León",
  "Salamanca",
  "Soria",
  "Valladolid",
  "Barcelona",
  "Girona",
  "Lleida",
  "Tarragona",
  "Alava",
  "Bizkaia",
  "Gipuzkoa",
  "Cáceres",
  "Ourense",
  "Pontevedra",
  "Madrid",
  "Murcia",
  "Navarra",
  "Alicante",
  "Valencia",
].sort((a, b) => b.length - a.length);

function splitProvinceLocalityClubResponsible(beforeEmail: string): {
  province: string;
  locality: string;
  name: string;
  responsible: string;
} {
  let rest = beforeEmail.trim();
  let province = "";
  for (const p of PROVINCES) {
    if (rest.startsWith(p)) {
      province = p;
      rest = rest.slice(p.length);
      break;
    }
  }

  const clubMarkers = [
    "POWERLIFTING",
    "POWER ",
    "STRENGTH",
    "BARBELL",
    "LIFTING",
    "LIFTERS",
    "CLUB",
    "TEAM",
    "GYM",
    "FORÇA",
    "FUERZA",
    "ASOCIACIÓN",
    "ASOCIACION",
    "FEDERACIÓN",
    "BULLS",
    "IRON",
    "RAW ",
    "ZEUS",
    "WAVES",
    "PEGASUS",
    "GALILIFTERS",
    "SPARTA",
    "BEGOAL",
    "RAGNAROK",
    "FENRIR",
    "GRANDA",
    "CROM ",
    "ATPOWER",
    "DANIGPOWER",
    "MIKEBARBELL",
    "BLACKBARBELL",
    "IRONBORN",
    "VENDETTA",
    "INTEND",
    "DISCIPLINE",
    "MENTALIFT",
    "CONRA",
    "CIUTAT",
    "PRAETORIANS",
    "MOONSTONE",
    "UNDERGROUND",
    "OLYMPIA",
    "FRENETIK",
    "RIVAL",
    "PBP ",
    "ATENEA",
    "VOLCANO",
    "UNITY",
    "GNO ",
    "NORBA",
    "BEÖRN",
    "FÉNIX",
    "ONI ",
    "720 ",
    "VÁKNER",
    "MYRTEA",
    "MONTOCÁN",
    "BANZAI",
    "FLOWERLIFTING",
    "KRAKEN",
    "ANVIL",
    "KOOK",
    "DEPORNIXAR",
    "EFFICIENT",
    "HUERCAL",
    "CHIPIONA",
    "BASIC ",
    "NAMEK",
    "RESTLESS",
    "GOAT ",
    "LIFTERS",
    "NAZARI",
    "AMBITION",
    "MOUNTAIN",
    "PRMODE",
    "PEPE ",
    "ALTERNATIVE",
    "ANDUJAR",
    "RANGERS",
    "ENERGY",
    "PROJECT",
    "MARBELLA",
    "VELIFT",
    "GUADAIRA",
    "ÉLITE",
    "ELITE ",
    "IRONSIDE",
    "GORILAS",
    "DU&QUE",
    "SOUTH ",
    "ATLETAS",
    "BARBASTRO",
    "ZARAGOZA",
    "GRIND ",
    "VETUSTA",
    "CONQUER",
    "WORKER",
    "CANARY",
    "TIGOT",
    "GUANCHE",
    "URUZ",
    "ELITETRAINER",
    "YOUNG ",
    "ECLIPSE",
    "INSANE",
    "SOHO ",
    "ZB ",
    "BARRAS",
    "BELIAL",
    "BERSERKERS",
    "ASTERION",
    "RS LIFTING",
    "CELTIBERIAN",
    "FUERZA NORTE",
    "NUMANCIA",
    "ASENSIO",
    "VALKYRIA",
    "ERASO",
    "HIRUGORRI",
    "HELL",
    "RAGE",
    "IZARRA",
    "STRONG ",
    "GOIERRI",
    "ZARAUTZ",
    "PRIME",
    "GIM VITAL",
    "RISING",
    "FORJA",
    "SPECIFIC",
    "VILLA ",
    "PUERTA",
    "IRON POWER",
    "SOUTHWEST",
    "EDUARDO",
    "AG ",
    "ALFA ",
    "ÉXITO",
    "HERU ",
    "LEVANTAMIENTO",
    "MAD ",
    "MGF ",
    "SIDEROPOLIS",
    "SILENT",
    "SUNDAY",
    "OVERSIZE",
    "VALHALLA",
    "BLACK CROWN",
    "LEONES",
    "HOME ",
    "ABLAZE",
    "WORK &",
    "POWER HOUSE",
    "ALTEA",
    "IRON TEAM",
    "AMIBI",
    "ISABEL",
    "GR STRENGTH",
  ];

  let clubStart = -1;
  for (const marker of clubMarkers) {
    const idx = rest.toUpperCase().indexOf(marker);
    if (idx >= 0 && (clubStart === -1 || idx < clubStart)) clubStart = idx;
  }

  if (clubStart === -1) {
    const upper = rest.search(/[A-ZÁÉÍÓÚÑ]{3}/);
    clubStart = upper >= 0 ? upper : 0;
  }

  const locality = rest.slice(0, clubStart).trim();
  const tail = rest.slice(clubStart).trim();

  const respMatch = tail.match(/^(.+?)([A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚa-záéíóúñ.]+)+)$/);
  if (respMatch) {
    return {
      province,
      locality,
      name: respMatch[1]!.trim(),
      responsible: respMatch[2]!.trim(),
    };
  }

  const words = tail.split(/\s+/);
  if (words.length >= 4) {
    const responsible = words.slice(-3).join(" ");
    const name = words.slice(0, -3).join(" ");
    return { province, locality, name: name || tail, responsible };
  }

  return { province, locality, name: tail, responsible: "" };
}

function parseClubs(text: string): AepClubRecord[] {
  const clubs: AepClubRecord[] = [];
  let region = "";
  let buffer = "";

  const flush = () => {
    const line = buffer.replace(/\s+/g, " ").trim();
    buffer = "";
    if (!line || SKIP_RE.test(line)) return;

    const extracted = extractEmail(line);
    if (!extracted) return;

    const parts = splitProvinceLocalityClubResponsible(extracted.beforeEmail);
    clubs.push({
      region,
      ...parts,
      email: extracted.email,
    });
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const rm = line.match(REGION_RE);
    if (rm) {
      flush();
      region = rm[1]!.trim();
      continue;
    }

    if (SKIP_RE.test(line)) continue;

    buffer += line;
    if (line.includes("@")) flush();
  }
  flush();

  const seen = new Set<string>();
  return clubs.filter((c) => {
    const key = `${c.name.toLowerCase()}|${c.email}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(c.name && c.email);
  });
}

async function main() {
  const buf = await fetch(PDF_URL).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.arrayBuffer();
  });
  const data = await pdf(Buffer.from(buf));
  let clubs = parseClubs(data.text);

  const corrections: Record<string, string> = {
    "nguezkooklevantamientosdepotencia@gmail.com": "kooklevantamientosdepotencia@gmail.com",
    "noguerrafael@gnoguer.com": "rafael@gnoguer.com",
    "-10-23@hotmmail.com": "antoni-10-23@hotmmail.com",
    "ilinfo@clubpowerliftingmadrid.com": "info@clubpowerliftingmadrid.com",
    "gilinfo@clubpowerliftingmadrid.com": "info@clubpowerliftingmadrid.com",
    "doinfo@homeandhealthfitness.com": "info@homeandhealthfitness.com",
    "liftingclub@gmail.com": "myrtealiftingclub@gmail.com",
    "lemail@gmail.com": "alemail@gmail.com",
    "agonbarbell@gmail.com": "aragonbarbell@gmail.com",
    "barbell@gmail.com": "zbbarbell@gmail.com",
    "clubraw@gmail.com": "barbellclubraw@gmail.com",
    "clubgalicia@gmail.com": "onibarbellclubgalicia@gmail.com",
  };

  clubs = clubs.map((c) => ({
    ...c,
    email: corrections[c.email] ?? c.email,
  }));
  const payload = {
    source: PDF_URL,
    updatedAt: "2026-04-18",
    count: clubs.length,
    clubs,
  };
  writeFileSync("src/lib/aep-clubs-registry.json", `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Importados ${clubs.length} clubes → src/lib/aep-clubs-registry.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
