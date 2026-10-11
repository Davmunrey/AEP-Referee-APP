import type { CompetitionCompensationSummary } from "@/lib/judge-compensation/types";

/**
 * Resúmenes del servidor ya pintados una vez.
 *
 * Al volver con «atrás», Next reutiliza la página que tenía en su caché, con
 * el MISMO objeto de resumen que ya se pintó la primera vez: lo editado
 * después no estaría. Un objeto ya visto delata esa vuelta.
 */
const pintados = new WeakSet<CompetitionCompensationSummary>();

/**
 * ¿Hay que pedir el resumen al montar el tablero? No si el servidor lo acaba
 * de mandar (primera vez que se ve ese objeto); sí sin resumen del servidor o
 * cuando es el de una visita anterior.
 */
export function debePedirResumen(initialSummary: CompetitionCompensationSummary | undefined): boolean {
  if (!initialSummary) return true;
  if (pintados.has(initialSummary)) return true;
  pintados.add(initialSummary);
  return false;
}

/**
 * Un resumen que llega con un refresco mientras el tablero ya está montado no
 * se pinta (se conserva lo que se está editando), pero también cuenta como
 * visto: si «atrás» devuelve ESE objeto, hay que pedir el actual.
 */
export function marcarResumenVisto(initialSummary: CompetitionCompensationSummary | undefined): void {
  if (initialSummary) pintados.add(initialSummary);
}
