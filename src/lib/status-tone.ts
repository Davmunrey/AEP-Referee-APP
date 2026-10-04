import type { EventStatus } from "@/lib/types";

/**
 * Color de la cobertura de una tarima, el mismo en toda la app: verde cuando
 * está completa, ámbar a medias, rojo en estado crítico y gris en borrador.
 *
 * Antes cada pantalla pintaba la barra a su manera y la lista de campeonatos
 * la llevaba siempre en el rojo de marca, también al 100 %: una tarima
 * completa se leía como un problema.
 */
export const STATUS_BAR: Record<EventStatus, string> = {
  Completo: "bg-success",
  Incompleto: "bg-warning",
  Crítico: "bg-destructive",
  Borrador: "bg-subtle",
};

export const STATUS_TEXT: Record<EventStatus, string> = {
  Completo: "text-success",
  Incompleto: "text-warning",
  Crítico: "text-destructive",
  Borrador: "text-muted-foreground",
};

/** Para agregados sin estado propio (zonas, años): solo por porcentaje. */
export function coverageBarClass(pct: number): string {
  if (pct >= 100) return STATUS_BAR.Completo;
  if (pct <= 0) return "bg-subtle";
  return pct >= 50 ? STATUS_BAR.Incompleto : STATUS_BAR.Crítico;
}

export function coverageTextClass(pct: number): string {
  if (pct >= 100) return STATUS_TEXT.Completo;
  if (pct <= 0) return "text-muted-foreground";
  return pct >= 50 ? STATUS_TEXT.Incompleto : STATUS_TEXT.Crítico;
}
