import { formatIbanDisplay } from "./iban";

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const AEP_HEADER_LINES = [
  "ASOCIACIÓN ESPAÑOLA DE POWERLIFTING",
  "(AEP)",
  "Calle San Fidel 103, esq. Gregorio Donas (local gimnasio)",
  "28017 Madrid, España/Spain",
  "Web: www.powerliftingspain.es, e-mail: powerhispania@gmail.com",
  "Facebook: Powerlifting-España Twitter: @Powerhispania",
  "YouTube: Powerlifting AEP Instagram: @powerhispania",
] as const;

const RULE_LINE =
  "____________________________________________________________________________________";
const SIGN_LINE =
  "__________________________________________________";

export { RULE_LINE, SIGN_LINE };

export type CompensationReceiptLayout = {
  headerLines: string[];
  organizerType: "club" | "aep" | "custom";
  returnEmailLines: string[];
  titleLines: string[];
  bodyParagraph: string;
  bodyClosingLines: string[];
};

export type CompensationOrganizerType = "club" | "aep" | "custom";

export type ClubAffiliationStyle = "afiliado" | "asociacion";
export type ClubPayerStyle = "club" | "club_deportivo" | "none";
export type CollaboratorStyle = "deportivo" | "voluntario";
export type ReceiptTitleStyle = "desplazamiento" | "simple";

export interface CompensationReceiptOrganizerClub {
  type: "club";
  clubName: string;
  clubEmail: string;
  affiliation?: ClubAffiliationStyle;
  volunteer?: boolean;
  payer?: ClubPayerStyle;
  title?: ReceiptTitleStyle;
  laborAsJudge?: boolean;
  competitionArticle?: "el" | "la";
}

export interface CompensationReceiptOrganizerAep {
  type: "aep";
}

/** Organizador personalizable: cabecera y correos de devolución libres. */
export interface CompensationReceiptOrganizerCustom {
  type: "custom";
  /** Nombre(s) de la entidad para la cabecera del recibo. */
  entityName: string;
  /** Correos de devolución ya formateados (p. ej. "a@x.com, b@y.com"). */
  emails: string;
}

export type CompensationReceiptOrganizer =
  | CompensationReceiptOrganizerClub
  | CompensationReceiptOrganizerAep
  | CompensationReceiptOrganizerCustom;

export interface CompensationReceiptInput {
  refereeName: string;
  amountEur: number;
  competitionName: string;
  sede: string;
  fecha: string;
  fechaFin: string;
  iban: string;
  organizer: CompensationReceiptOrganizer;
  breakdownLines?: { label: string; amount: number; detail?: string }[];
}

interface ParsedIsoDate {
  year: number;
  month: number;
  day: number;
}

function parseIsoDate(iso: string): ParsedIsoDate {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

/** Importe en euros con coma decimal, como en los recibos AEP. */
export function formatReceiptAmountEur(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded}€`;
  return `${rounded.toFixed(2).replace(".", ",")}€`;
}

/** Frase de fecha del campeonato («el día…» / «los días…»). */
export function formatCompetitionDatePhrase(fecha: string, fechaFin: string): string {
  const start = parseIsoDate(fecha);
  const end = parseIsoDate(fechaFin);
  const startMonth = MONTHS_ES[start.month];
  const endMonth = MONTHS_ES[end.month];

  if (fecha === fechaFin) {
    return `el día ${start.day} de ${startMonth} de ${start.year}`;
  }

  if (start.year === end.year && start.month === end.month) {
    if (end.day - start.day === 1) {
      return `los días ${start.day} y ${end.day} de ${startMonth} de ${start.year}`;
    }
    return `los días ${start.day}-${end.day} de ${startMonth} de ${start.year}`;
  }

  if (start.year === end.year) {
    return `los días ${start.day} de ${startMonth} y ${end.day} de ${endMonth} de ${start.year}`;
  }

  return `del ${start.day} de ${startMonth} de ${start.year} al ${end.day} de ${endMonth} de ${end.year}`;
}

function celebrationGender(fecha: string, fechaFin: string): "a" | "o" {
  return fecha === fechaFin ? "a" : "o";
}

// Sustantivos de competición femeninos; el resto (Campeonato, Trofeo, Torneo,
// Open, Clasificatorio, Memorial, Regional…) son masculinos.
const FEMININE_COMPETITION_WORDS = new Set([
  "copa",
  "supercopa",
  "liga",
  "competicion",
  "final",
  "jornada",
  "fase",
  "exhibicion",
  "prueba",
  "concentracion",
]);

/**
 * Artículo (`el`/`la`) que concuerda con el nombre del campeonato. Ignora un
 * prefijo de numeral romano u ordinal ("III Campeonato…") y mira el primer
 * sustantivo. Para nombres combinados ("Campeonato … y Regional …") decide por
 * el primero. Devuelve también el género para el participio "celebrad{o/a}".
 */
function competitionAgreement(name: string): { article: "el" | "la"; celebrated: "a" | "o" } {
  const cleaned = name
    .trim()
    .replace(/^(?:[ivxlcdm]+|\d+[.ºªo]?)\s+/i, "");
  const first = (cleaned.split(/\s+/)[0] ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const feminine = FEMININE_COMPETITION_WORDS.has(first);
  return { article: feminine ? "la" : "el", celebrated: feminine ? "a" : "o" };
}

function buildHeaderLines(organizer: CompensationReceiptOrganizer): string[] {
  if (organizer.type === "aep") {
    return [...AEP_HEADER_LINES];
  }

  if (organizer.type === "custom") {
    return [organizer.entityName];
  }

  const affiliation =
    organizer.affiliation === "asociacion"
      ? "Asociación Española de Powerlifting (AEP)"
      : "Afiliado a la Asociación Española de Powerlifting (AEP)";

  return [organizer.clubName, affiliation];
}

function buildReturnEmailLine(organizer: CompensationReceiptOrganizer): string {
  if (organizer.type === "aep") {
    return [
      "a devolver al e-mail: JuecesAEP@gmail.com,",
      "con copia a los e-mail: TesoreroAEP@gmail.com",
      "y PresidenteAEP@gmail.com",
    ].join("\n");
  }
  if (organizer.type === "custom") {
    return `a devolver al e-mail: ${organizer.emails}`;
  }
  return `a devolver al e-mail: ${organizer.clubEmail}`;
}

function buildTitleLines(organizer: CompensationReceiptOrganizer): string[] {
  if (organizer.type === "aep" || organizer.type === "custom") {
    return [
      "Compensación de gastos de desplazamiento",
      "por arbitraje en competición oficial",
    ];
  }

  if (organizer.title === "simple") {
    return ["Compensación de gastos por arbitraje en", "competición oficial"];
  }

  return [
    "Compensación de gastos de desplazamiento",
    "por arbitraje en competición oficial",
  ];
}

function buildCollaboratorPhrase(organizer: CompensationReceiptOrganizer): string {
  if (organizer.type === "aep" || organizer.type === "custom") {
    return "Colaborador Deportivo";
  }
  return organizer.volunteer
    ? "colaborador deportivo voluntario"
    : "Colaborador Deportivo";
}

function buildReceivedPhrase(
  organizer: CompensationReceiptOrganizer,
  amount: string,
): string {
  if (organizer.type === "aep") {
    return `he recibido, la cantidad de ${amount}`;
  }

  if (organizer.type === "custom") {
    return `he recibido la cantidad de ${amount}`;
  }

  switch (organizer.payer ?? "club") {
    case "club_deportivo": {
      const clubLabel = organizer.clubName.replace(/^Club\s+/i, "");
      return `he recibido del club deportivo ${clubLabel} la cantidad de ${amount}`;
    }
    case "none":
      return `he recibido la cantidad de ${amount}`;
    case "club":
    default:
      return `he recibido del Club ${organizer.clubName.replace(/^Club\s+/i, "")} la cantidad de ${amount}`;
  }
}

function buildLaborPhrase(
  organizer: CompensationReceiptOrganizer,
  competitionName: string,
): string {
  if (organizer.type === "aep" || organizer.type === "custom") {
    const { article } = competitionAgreement(competitionName);
    return `por la labor prestada como juez en ${article} ${competitionName}`;
  }

  const article = organizer.competitionArticle ?? "la";
  if (organizer.laborAsJudge === false) {
    return `por la labor prestada en ${article} ${competitionName}`;
  }
  return `por la labor prestada como juez en ${article} ${competitionName}`;
}

function formatCelebrationPhrase(
  sede: string,
  fecha: string,
  fechaFin: string,
  gender: "a" | "o",
): string {
  const datePhrase = formatCompetitionDatePhrase(fecha, fechaFin);
  if (fecha === fechaFin) {
    return `celebrad${gender} en ${sede} ${datePhrase}`;
  }
  return `celebrad${gender} en ${sede}, ${datePhrase}`;
}

function buildBodyParagraph(input: CompensationReceiptInput): string {
  const amount = formatReceiptAmountEur(input.amountEur);
  // Para AEP el participio concuerda con el género del campeonato (el Campeonato
  // celebrado / la Copa celebrada). El club conserva su lógica previa.
  const gender =
    input.organizer.type === "aep" || input.organizer.type === "custom"
      ? competitionAgreement(input.competitionName).celebrated
      : celebrationGender(input.fecha, input.fechaFin);
  const collaborator = buildCollaboratorPhrase(input.organizer);
  const received = buildReceivedPhrase(input.organizer, amount);
  const labor = buildLaborPhrase(input.organizer, input.competitionName);
  const celebration = formatCelebrationPhrase(input.sede, input.fecha, input.fechaFin, gender);

  return `Yo, ${input.refereeName}, en calidad de ${collaborator}, ${received} en concepto de compensación de gastos ${labor} ${celebration}, a ingresar en la siguiente cuenta bancaria:`;
}

function buildBodyClosingLines(input: CompensationReceiptInput): string[] {
  const ibanDisplay = formatIbanDisplay(input.iban);
  return [
    `IBAN: ${ibanDisplay}`,
    "Y para que conste, firmo el presente documento.",
    "Fecha:",
    `Fdo. ${input.refereeName}`,
  ];
}

/** Estructura del recibo AEP/club (sin desglose; el desglose solo se muestra en el modal). */
export function buildCompensationReceiptLayout(input: CompensationReceiptInput): CompensationReceiptLayout {
  return {
    headerLines: buildHeaderLines(input.organizer),
    organizerType: input.organizer.type,
    returnEmailLines: buildReturnEmailLine(input.organizer).split("\n"),
    titleLines: buildTitleLines(input.organizer),
    bodyParagraph: buildBodyParagraph(input),
    bodyClosingLines: buildBodyClosingLines(input),
  };
}

/** Construye el texto completo del recibo (una línea por párrafo lógico). */
export function buildCompensationReceiptLines(input: CompensationReceiptInput): string[] {
  const layout = buildCompensationReceiptLayout(input);
  return [
    ...layout.headerLines,
    RULE_LINE,
    SIGN_LINE,
    ...layout.returnEmailLines,
    ...layout.titleLines,
    layout.bodyParagraph,
    ...layout.bodyClosingLines,
  ];
}

export function buildCompensationReceiptText(input: CompensationReceiptInput): string {
  return `${buildCompensationReceiptLines(input).join("\n")}\n`;
}

/** Nombre de archivo sugerido al exportar (sin IBAN). */
export function compensationReceiptFilename(refereeName: string, competitionName: string): string {
  const slug = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);
  return `compensacion_${slug(refereeName)}_${slug(competitionName)}.pdf`;
}
