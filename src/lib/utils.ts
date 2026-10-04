import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge tiene que conocer la escala tipográfica propia (tokens.css):
 * si no, lee `text-ui` o `text-2xs` como un COLOR de texto y, al fusionar,
 * borra el color de verdad (`text-primary-foreground` de un botón rojo
 * desaparecía y el texto salía negro sobre rojo).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["2xs", "ui", "title", "heading", "display"],
      tracking: ["tighter", "tight", "snug"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Fecha ISO solo-día → Date en hora LOCAL (evita el desfase UTC de `new Date`). */
function isoToLocalDate(iso: string): Date {
  const [y, mo, d] = String(iso).split(/[-T]/).map(Number);
  if (y && mo && d) return new Date(y, mo - 1, d);
  return new Date(iso);
}

export function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const s = isoToLocalDate(start);
  const e = isoToLocalDate(end);
  const sameDay = start === end;
  if (sameDay) {
    return s.toLocaleDateString("es-ES", opts);
  }
  return `${s.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("es-ES", opts)}`;
}

/** Un día suelto, como el resto de la interfaz: «25 oct 2026», nunca «2026-10-25». */
export function formatDate(iso: string) {
  return formatDateRange(iso, iso);
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
