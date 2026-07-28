// Validación pura de los tickets de soporte: whitelists, límites de campo y
// reglas de los ficheros adjuntos. Sin dependencias de red ni de Supabase para
// poder reutilizarse tanto en las rutas API como en los tests unitarios.
import type { SessionUser, TicketCategory, TicketStatus } from "@/lib/types";

// ── Whitelists ──────────────────────────────────────────────────────────────
export const TICKET_CATEGORIES: readonly TicketCategory[] = [
  "incidencia",
  "mejora",
  "duda",
  "otro",
];

export const TICKET_STATUSES: readonly TicketStatus[] = [
  "abierto",
  "en_progreso",
  "resuelto",
  "cerrado",
];

// ── Límites de campos ───────────────────────────────────────────────────────
export const TITULO_MIN = 4;
export const TITULO_MAX = 140;
export const DESCRIPCION_MIN = 10;
export const DESCRIPCION_MAX = 5000;
export const COMMENT_BODY_MIN = 1;
export const COMMENT_BODY_MAX = 3000;

// ── Límites de adjuntos ─────────────────────────────────────────────────────
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_CONTENT_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export function isTicketCategory(value: unknown): value is TicketCategory {
  return typeof value === "string" && TICKET_CATEGORIES.includes(value as TicketCategory);
}

export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && TICKET_STATUSES.includes(value as TicketStatus);
}

/**
 * Admins de tickets: autoridad total sobre la zona de soporte. Mismo par de
 * roles que `canAdminJudges`, y mismo prefijo `can…` a propósito: las rutas
 * API deben dejar el guard RBAC a la vista, y la comprobación de production
 * readiness (API-02) busca justamente esa convención.
 */
export function canAdminTickets(user: SessionUser): boolean {
  return user.role === "super_admin" || user.role === "delegado_jueces";
}

/**
 * Valida un campo de texto obligatorio contra un rango de longitud (recortado).
 * Devuelve un mensaje de error legible o `null` si es válido.
 */
function validateText(
  raw: unknown,
  label: string,
  min: number,
  max: number,
): string | null {
  if (typeof raw !== "string") return `${label} es obligatorio`;
  const value = raw.trim();
  if (value.length < min) return `${label} debe tener al menos ${min} caracteres`;
  if (value.length > max) return `${label} no puede superar ${max} caracteres`;
  return null;
}

export function validateTitulo(raw: unknown): string | null {
  return validateText(raw, "El título", TITULO_MIN, TITULO_MAX);
}

export function validateDescripcion(raw: unknown): string | null {
  return validateText(raw, "La descripción", DESCRIPCION_MIN, DESCRIPCION_MAX);
}

export function validateCommentBody(raw: unknown): string | null {
  return validateText(raw, "El comentario", COMMENT_BODY_MIN, COMMENT_BODY_MAX);
}

/**
 * Sanea el nombre de un fichero para usarlo en la ruta de storage: conserva
 * letras/números/punto/guiones, colapsa el resto a `_` y recorta la longitud.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+/, "")
    .slice(0, 100);
  return cleaned || "adjunto";
}

/** Metadatos mínimos de un fichero para validarlo antes de subirlo. */
export interface FileMeta {
  fileName: string;
  contentType: string;
  size: number;
}

/** Valida un fichero individual. Devuelve mensaje de error o `null`. */
export function validateFile(file: FileMeta): string | null {
  if (!ALLOWED_CONTENT_TYPES.includes(file.contentType)) {
    return `Tipo de fichero no permitido: ${file.contentType || "desconocido"}`;
  }
  if (file.size <= 0) return `El fichero «${file.fileName}» está vacío`;
  if (file.size > MAX_FILE_BYTES) {
    return `El fichero «${file.fileName}» supera el máximo de 5 MB`;
  }
  return null;
}

/** Valida una lista de ficheros (número máximo + cada uno). */
export function validateFiles(files: readonly FileMeta[]): string | null {
  if (files.length > MAX_FILES) return `Máximo ${MAX_FILES} ficheros por envío`;
  for (const file of files) {
    const err = validateFile(file);
    if (err) return err;
  }
  return null;
}
