/** Tipos y textos del acceso de los jueces al portal (cliente y servidor). */

export type JudgeAccessStatus = "sin-acceso" | "con-acceso" | "revocado";

export type JudgeInviteOutcome =
  /** Cuenta nueva creada; le llega la invitación. */
  | "invitado"
  /** Ya tenía acceso: se le reenvía el enlace para entrar. */
  | "enlace-reenviado"
  /** Tenía el acceso retirado: se reactiva y se le envía el enlace. */
  | "reactivado"
  | "sin-email"
  /** El e-mail de la ficha ya es de otra cuenta (p. ej. la de un delegado). */
  | "email-en-uso"
  | "no-encontrado"
  | "error";

export interface JudgeInviteResult {
  refereeId: string;
  nombre: string;
  email?: string;
  outcome: JudgeInviteOutcome;
}

export const JUDGE_ACCESS_LABEL: Record<JudgeAccessStatus, string> = {
  "sin-acceso": "Sin acceso",
  "con-acceso": "Con acceso",
  revocado: "Acceso retirado",
};

export const JUDGE_INVITE_OUTCOME_LABEL: Record<JudgeInviteOutcome, string> = {
  invitado: "Invitado",
  "enlace-reenviado": "Enlace reenviado",
  reactivado: "Acceso reactivado",
  "sin-email": "Sin e-mail en la ficha",
  "email-en-uso": "El e-mail ya es de otra cuenta",
  "no-encontrado": "No encontrado",
  error: "No se pudo enviar",
};

/** Los resultados que piden que alguien haga algo. */
export function isInviteProblem(outcome: JudgeInviteOutcome): boolean {
  return outcome === "sin-email" || outcome === "email-en-uso" || outcome === "no-encontrado" || outcome === "error";
}
