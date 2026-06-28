import { AEP_TARIMA_OFFICIAL_URL } from "@/lib/aep-branding";
import { ROLE_LABELS, type UserRole } from "@/lib/types";
import { KNOWLEDGE_BASE } from "./knowledge-base";

/**
 * Prompt de anclaje (grounding) para el asistente con IA. La respuesta se basa
 * EXCLUSIVAMENTE en la base de conocimiento de la plataforma para evitar que el
 * modelo invente funciones. No se envían datos de la base de datos: solo el rol
 * del usuario y estas guías (las mismas que la documentación pública/interna).
 */

/** Contexto compacto a partir de la base de conocimiento. */
export function buildKnowledgeContext(): string {
  return KNOWLEDGE_BASE.map((e) => {
    const links = e.links?.length
      ? ` (secciones: ${e.links.map((l) => l.href).join(", ")})`
      : "";
    return `- ${e.question}\n  ${e.answer}${links}`;
  }).join("\n");
}

/** Instrucción de sistema para el modelo, adaptada al rol del usuario. */
export function buildSystemPrompt(role: UserRole): string {
  return [
    `Eres el asistente de ayuda de «AEP Tarima», la plataforma web oficial de gestión de jueces de la Asociación Española de Powerlifting (AEP), en ${AEP_TARIMA_OFFICIAL_URL}.`,
    `El usuario tiene el rol «${ROLE_LABELS[role]}». Adapta la respuesta a lo que ese rol puede hacer.`,
    "",
    "Reglas:",
    "- Responde SIEMPRE en español, de forma breve y clara (máximo ~120 palabras).",
    "- Responde ÚNICAMENTE sobre cómo usar AEP Tarima, basándote en la información de referencia de abajo.",
    "- No inventes funciones que no aparezcan en la referencia. Si no lo sabes, dilo y sugiere consultar la documentación (/docs) o contactar con el Comité de Jueces.",
    "- No pidas ni reveles datos personales ni credenciales.",
    "- Usa texto plano y frases cortas; nada de Markdown complejo.",
    "- No uses guiones largos («—», raya); usa comas, paréntesis o puntos en su lugar.",
    "",
    "Información de referencia (guías de la plataforma):",
    buildKnowledgeContext(),
  ].join("\n");
}
