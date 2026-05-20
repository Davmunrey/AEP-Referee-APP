import type { EventType } from "./types";
import {
  AEP_GEOGRAPHIC_ZONES,
  geographicZoneName,
  resolveZoneCode,
  zoneDisplayName,
} from "@/lib/aep-zones";

export {
  AEP_GEOGRAPHIC_ZONES,
  geographicZoneName,
  resolveZoneCode,
  zoneDisplayName,
};

/** Metadatos oficiales — Guía AEP (diciembre 2025, temporada 2026). */
export const AEP_GUIDE_META = {
  title: "Guía AEP",
  season: "2026",
  updated: "30/12/2025",
  updatedLabel: "diciembre 2025",
} as const;

/** @deprecated Usar `resolveZoneCode` + `zoneDisplayName`. */
export function operationalToGeographicName(code: string): string | undefined {
  const resolved = resolveZoneCode(code);
  if (!resolved) return undefined;
  return geographicZoneName(resolved);
}

/** Niveles competitivos AEP (§4.2 Guía AEP 2026). */
export const AEP_COMPETITION_LEVELS: {
  type: EventType;
  title: string;
  summary: string;
  bullets: string[];
}[] = [
  {
    type: "AEP-3",
    title: "AEP-3 — Nivel local",
    summary: "Entrada al sistema competitivo AEP.",
    bullets: [
      "Cualquier atleta afiliado puede participar; la plaza la concede el club organizador.",
      "El organizador indica si el campeonato dura uno o dos días.",
      "Premios: solo atletas con menos de 85 puntos IPF GL.",
      "Cuota inscripción campeonato: 30 € (además de licencia anual).",
    ],
  },
  {
    type: "AEP-2",
    title: "AEP-2 — Regional y clasificatorio",
    summary: "Escalón intermedio; acceso a Open nacional vía clasificatorio.",
    bullets: [
      "Regional: máximo 2 AEP-2 por zona y temporada; solo atletas de clubes de la zona; marca mínima regional.",
      "Clasificatorio: una competición anual a mitad de temporada; marca mínima Open; excluye Subjunior y Máster 3/4.",
      "Cuota inscripción campeonato: 50 € (AEP-1, AEP-2 y clasificatorio).",
    ],
  },
  {
    type: "AEP-1",
    title: "AEP-1 — Nivel nacional",
    summary: "Máximo nivel nacional (Open, por edad, Copa de España, etc.).",
    bullets: [
      "Open: Copa de España Open y Campeonato de España Absoluto.",
      "Subjunior / Junior: marca mínima nacional previa.",
      "Máster: sin marca previa para inscribirse; para premios, alcanzar MMN en la propia competición.",
      "Cuota inscripción campeonato: 50 €.",
    ],
  },
];

export const AEP_COMPETITION_TYPE_DESC: Record<EventType, string> = Object.fromEntries(
  AEP_COMPETITION_LEVELS.map((l) => [l.type, l.summary]),
) as Record<EventType, string>;

/** Cuotas y licencias temporada 2026 (§2 Guía AEP). */
export const AEP_FEES_2026 = {
  licenciaOrdinaria: 75,
  licenciaBasica: 25,
  afiliacionClub: 115,
  inscripcionAep123: 50,
  inscripcionAep3: 30,
  examenJuezNacional: 50,
  inscripcionEpf: 150,
  inscripcionIpf: 135,
  entrenadorAdicional: 20,
} as const;

/** Requisitos jueces (§2.1.2 Guía AEP 2026). */
export const AEP_JUDGE_LICENSE_NOTE =
  "Los jueces en activo deben contar, como mínimo, con Licencia Básica AEP (25 €/año). Derechos de examen a Juez Nacional AEP: 50 €.";

/** Marcas mínimas totales (kg) — §5 Guía AEP 2026. */
export const AEP_MIN_MARKS = {
  regional: {
    label: "Marca mínima regional (MMR)",
    note: "Acceso AEP-2 regional. Validez permanente en la categoría conseguida o superiores (con requisito de subida).",
    female: [
      { cat: "-47", kg: 230 },
      { cat: "-52", kg: 250 },
      { cat: "-57", kg: 270 },
      { cat: "-63", kg: 285 },
      { cat: "-69", kg: 300 },
      { cat: "-76", kg: 315 },
      { cat: "-84", kg: 325 },
      { cat: "+84", kg: 330 },
    ],
    male: [
      { cat: "-59", kg: 380 },
      { cat: "-66", kg: 435 },
      { cat: "-74", kg: 480 },
      { cat: "-83", kg: 520 },
      { cat: "-93", kg: 540 },
      { cat: "-105", kg: 550 },
      { cat: "-120", kg: 555 },
      { cat: "+120", kg: 560 },
    ],
  },
  open: {
    label: "Marca mínima Open (MMO)",
    note: "Requisito para Campeonato AEP-2 Clasificatorio; no da plaza directa en AEP-1.",
    female: [
      { cat: "-47", kg: 250 },
      { cat: "-52", kg: 290 },
      { cat: "-57", kg: 315 },
      { cat: "-63", kg: 335 },
      { cat: "-69", kg: 350 },
      { cat: "-76", kg: 365 },
      { cat: "-84", kg: 375 },
      { cat: "+84", kg: 380 },
    ],
    male: [
      { cat: "-59", kg: 420 },
      { cat: "-66", kg: 480 },
      { cat: "-74", kg: 545 },
      { cat: "-83", kg: 590 },
      { cat: "-93", kg: 630 },
      { cat: "-105", kg: 650 },
      { cat: "-120", kg: 660 },
      { cat: "+120", kg: 670 },
    ],
  },
} as const;

/** Secciones resumidas para la UI de Reglamentos. */
export const AEP_GUIDE_SECTIONS = [
  {
    id: "intro",
    title: "Alcance",
    body: `La Guía AEP unifica afiliación, estructura competitiva, marcas mínimas e inscripciones. Tiene carácter normativo e informativo; en caso de discrepancia con una convocatoria concreta, prevalece la convocatoria oficial.`,
  },
  {
    id: "licencias",
    title: "Licencias y cuotas 2026",
    body: `Licencia ordinaria atleta: ${AEP_FEES_2026.licenciaOrdinaria} €/año. Licencia básica (entrenadores, técnicos, jueces, etc.): ${AEP_FEES_2026.licenciaBasica} €/año. ${AEP_JUDGE_LICENSE_NOTE}`,
  },
  {
    id: "zonas",
    title: "Zonas geográficas",
    body: "Cinco zonas operativas del Excel de jueces (1- NOROESTE … 5- CANARIAS). En AEP Tarima delegados, campeonatos y jueces usan los códigos NOROESTE, CENTRO, MEDITERRANEO, ANDALUCIA y CANARIAS.",
  },
  {
    id: "niveles",
    title: "Estructura AEP-1 / AEP-2 / AEP-3",
    body: "Progresión local → regional/clasificatorio → nacional. Los campeonatos finalizados quedan en solo lectura en la tarima.",
  },
  {
    id: "docs",
    title: "Documentación complementaria",
    body: "Estatutos AEP, Reglamento técnico IPF, Guía de organización de campeonatos, Guía creación de clubes y Reglamento disciplinario (documentos aparte).",
  },
] as const;
