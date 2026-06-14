import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = start === end;
  if (sameDay) {
    return s.toLocaleDateString("es-ES", opts);
  }
  return `${s.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("es-ES", opts)}`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * "Última competición" se guarda como etiqueta ya formateada. Cuando el Excel de
 * origen trae la celda vacía, el serial 0 se interpreta como el epoch de la hoja
 * (p. ej. "1 ene 1899") y esa fecha centinela acababa mostrándose en la tabla.
 * Toda competición real es de 2000 en adelante, así que cualquier año `1xxx` es
 * un centinela: lo normalizamos a guion.
 */
export function displayUltimo(label: string | null | undefined): string {
  const trimmed = label?.trim();
  if (!trimmed || /\b1\d{3}\b/.test(trimmed)) return "—";
  return trimmed;
}
