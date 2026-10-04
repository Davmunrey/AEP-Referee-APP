/**
 * Tipos y textos del acceso de los jueces al portal (cliente y servidor).
 *
 * La aplicación no envía correos: el delegado da a cada juez un código de
 * acceso y se lo pasa por su cuenta (WhatsApp, en mano). Con su e-mail del
 * censo y el código, el juez crea su contraseña; después entra como cualquier
 * otra cuenta.
 */

export type JudgeAccessStatus =
  /** Sin cuenta en el portal. */
  | "sin-acceso"
  /** Tiene un código sin usar: aún no ha creado su contraseña. */
  | "codigo-pendiente"
  | "con-acceso"
  | "revocado";

export type JudgeCodeOutcome =
  /** Código generado (y cuenta creada o reactivada si hacía falta). */
  | "codigo"
  | "sin-email"
  /** El e-mail de la ficha ya es de otra cuenta (p. ej. la de un delegado). */
  | "email-en-uso"
  | "no-encontrado"
  | "error";

export interface JudgeCodeResult {
  refereeId: string;
  nombre: string;
  email?: string;
  outcome: JudgeCodeOutcome;
  /** Solo en la respuesta que lo genera: después no se puede volver a leer. */
  code?: string;
  expiresAt?: string;
}

/** Días que vale un código sin usar. */
export const ACCESS_CODE_TTL_DAYS = 14;
/** Intentos fallidos con un mismo código antes de anularlo. */
export const ACCESS_CODE_MAX_ATTEMPTS = 5;
/** Mínimo de la contraseña que crea el juez (igual que las de gestión). */
export const JUDGE_PASSWORD_MIN = 8;

export const JUDGE_ACCESS_LABEL: Record<JudgeAccessStatus, string> = {
  "sin-acceso": "Sin acceso",
  "codigo-pendiente": "Código sin usar",
  "con-acceso": "Con acceso",
  revocado: "Acceso retirado",
};

export const JUDGE_CODE_OUTCOME_LABEL: Record<JudgeCodeOutcome, string> = {
  codigo: "Código generado",
  "sin-email": "Sin e-mail en la ficha",
  "email-en-uso": "El e-mail ya es de otra cuenta",
  "no-encontrado": "No encontrado",
  error: "No se pudo generar",
};

/** Los resultados que piden que alguien haga algo. */
export function isCodeProblem(outcome: JudgeCodeOutcome): boolean {
  return outcome !== "codigo";
}

/**
 * Letras y cifras sin las que se confunden al dictarlas o leerlas en un móvil
 * (0/O, 1/I/L): 31 símbolos, 8 posiciones, unos 8,5 · 10¹¹ códigos.
 */
export const ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** «k7qm 4tzp», «K7QM-4TZP», «k7qm4tzp» → «K7QM4TZP». */
export function normalizeAccessCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** «K7QM4TZP» → «K7QM-4TZP», para enseñarlo y dictarlo. */
export function formatAccessCode(code: string): string {
  const clean = normalizeAccessCode(code);
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/** El mensaje que el delegado copia para mandárselo al juez. */
export function accessCodeMessage(opts: {
  nombre: string;
  email?: string;
  code: string;
  expiresLabel: string;
  siteUrl: string;
}): string {
  const nombre = opts.nombre.trim().split(/\s+/)[0] ?? opts.nombre;
  return [
    `Hola, ${nombre}. Ya tienes acceso al portal de jueces de la AEP.`,
    `1. Entra en ${opts.siteUrl}/sign-in?codigo=1`,
    `2. Escribe tu e-mail${opts.email ? ` (${opts.email})` : ""} y este código: ${formatAccessCode(opts.code)}`,
    `3. Crea tu contraseña. Con ella entrarás a partir de ahora.`,
    `El código vale hasta el ${opts.expiresLabel} y solo sirve una vez.`,
  ].join("\n");
}
