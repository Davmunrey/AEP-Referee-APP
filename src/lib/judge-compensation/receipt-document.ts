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

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `null` si la cadena no es una fecha ISO utilizable.
 *
 * Antes partía por guiones sin mirar nada: una fecha vacía daba «el día
 * undefined de undefined de 0», una ilegible «el día NaN de undefined de
 * NaN», y un mes 13 se quedaba sin nombre de mes. Todo eso se imprimía en el
 * recibo, que es un documento que va al juez y al club.
 */
function parseIsoDate(iso: string): ParsedIsoDate | null {
  const match = ISO_DAY_RE.exec(String(iso ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Rechaza los días que ese mes no tiene (un 31 de abril, un 29 de febrero
  // fuera de bisiesto): `Date` los desborda al mes siguiente en silencio.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { year, month: month - 1, day };
}

/** Lo que se imprime cuando el campeonato no tiene fechas utilizables. */
export const RECEIPT_DATE_UNKNOWN = "en fecha sin registrar";

/**
 * Importe en euros con coma decimal, como en los recibos AEP.
 *
 * Última red antes del papel: un importe ilegible daba «NaN€» impreso en un
 * documento que va al juez y al club. Un importe que no es un número se
 * enseña como lo que es —un hueco—, no como una cifra rara.
 */
export function formatReceiptAmountEur(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded}€`;
  return `${rounded.toFixed(2).replace(".", ",")}€`;
}

/** Frase de fecha del campeonato («el día…» / «los días…»). */
export function formatCompetitionDatePhrase(fecha: string, fechaFin: string): string {
  const start = parseIsoDate(fecha);
  // Sin fecha de fin utilizable se asume campeonato de un día, igual que en el
  // resto del dominio; sin fecha de inicio no hay nada que afirmar.
  const end = parseIsoDate(fechaFin) ?? start;
  if (!start || !end) return RECEIPT_DATE_UNKNOWN;
  const startMonth = MONTHS_ES[start.month];
  const endMonth = MONTHS_ES[end.month];

  if (start.year === end.year && start.month === end.month && start.day === end.day) {
    return `el día ${start.day} de ${startMonth} de ${start.year}`;
  }

  if (start.year === end.year && start.month === end.month) {
    if (end.day - start.day === 1) {
      return `los días ${start.day} y ${end.day} de ${startMonth} de ${start.year}`;
    }
    return `los días ${start.day}-${end.day} de ${startMonth} de ${start.year}`;
  }

  if (start.year === end.year) {
    const spanDays = Math.round(
      (Date.UTC(end.year, end.month, end.day) - Date.UTC(start.year, start.month, start.day)) /
        86_400_000,
    );
    // Solo dos días consecutivos entre meses (30 abr y 1 may) se enumeran con
    // "y"; un rango mayor usa "del … al …" — antes "29 de abril y 2 de mayo"
    // afirmaba dos días y hacía desaparecer el 30 y el 1 del recibo.
    if (spanDays === 1) {
      return `los días ${start.day} de ${startMonth} y ${end.day} de ${endMonth} de ${start.year}`;
    }
    return `del ${start.day} de ${startMonth} al ${end.day} de ${endMonth} de ${start.year}`;
  }

  return `del ${start.day} de ${startMonth} de ${start.year} al ${end.day} de ${endMonth} de ${end.year}`;
}

/** Sustantivos de competición femeninos, incluidos los ingleses de uso común
 * en nombres de club (una «Cup» es una copa: «la Young Ambition Cup»). */
const FEMININE_COMPETITION_WORDS = new Set([
  "copa",
  "supercopa",
  "cup",
  "liga",
  "league",
  "competicion",
  "final",
  "jornada",
  "fase",
  "exhibicion",
  "prueba",
  "concentracion",
  "olimpiada",
  "clasificatoria",
  "categoria",
]);

/** Sustantivos de competición masculinos. */
const MASCULINE_COMPETITION_WORDS = new Set([
  "campeonato",
  "trofeo",
  "torneo",
  "open",
  "memorial",
  "circuito",
  "encuentro",
  "clasificatorio",
  "regional",
  "nacional",
  "autonomico",
  "master",
  "meeting",
  "challenge",
  "campus",
  "gran",
  "premio",
]);

/**
 * Artículo (`el`/`la`) y participio (`celebrad{o|a}`) que concuerdan con el
 * nombre del campeonato.
 *
 * Busca el **sustantivo principal en cualquier posición**, no solo la primera
 * palabra: los nombres de club suelen llevarlo al final («Young Ambition Cup»),
 * y mirar solo el principio daba «el Young Ambition Cup». Se salta numerales
 * romanos, ordinales y las palabras que no son sustantivo de competición, y
 * decide por el primero que reconoce, de modo que un nombre combinado
 * («Campeonato … y Copa …») concuerda con el primero, que es el que manda.
 *
 * Sin sustantivo reconocible se usa el masculino, que es la forma no marcada.
 */
function competitionAgreement(name: string): { article: "el" | "la"; celebrated: "a" | "o" } {
  const tokens = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  for (const token of tokens) {
    if (FEMININE_COMPETITION_WORDS.has(token)) return { article: "la", celebrated: "a" };
    if (MASCULINE_COMPETITION_WORDS.has(token)) return { article: "el", celebrated: "o" };
  }
  return { article: "el", celebrated: "o" };
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

  // El club usaba "la" fijo porque la regla anterior solo miraba la primera
  // palabra y no acertaba con los nombres de club. Ahora concuerda igual que
  // los demás; `competitionArticle` sigue mandando cuando se fija a mano.
  const article = organizer.competitionArticle ?? competitionAgreement(competitionName).article;
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
  // El participio concuerda con el género del campeonato (el Campeonato
  // celebrado / la Copa celebrada), igual para todos los organizadores. Antes
  // el club lo decidía por la DURACIÓN —un día «celebrada», varios
  // «celebrado»—, que acierta por casualidad cuando las pruebas de un día son
  // copas y falla en cuanto no lo son.
  const gender = competitionAgreement(input.competitionName).celebrated;
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
