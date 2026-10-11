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
