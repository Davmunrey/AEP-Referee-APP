import type { CompensationClaimStatus } from "@/lib/judge-compensation/types";

/**
 * Estados de liquidación que congelan el puesto de un juez en la tarima.
 *
 * Una liquidación **pagada** ya ha salido de la cuenta: su importe corresponde
 * a unos servicios concretos —sesiones y pesajes de esos huecos—, así que
 * quitar al juez de la tarima deja un pago sin nada que lo respalde y un acta
 * que no cuadra con lo que se cobró. La sustitución se bloquea; para hacerla
 * hay que deshacer antes el pago desde la pantalla de compensación.
 */
const REMOVAL_BLOCKING_STATUSES: ReadonlySet<CompensationClaimStatus> = new Set(["pagado"]);

export function blocksRosterRemoval(
  status: CompensationClaimStatus | string | null | undefined,
): boolean {
  return REMOVAL_BLOCKING_STATUSES.has(String(status ?? "") as CompensationClaimStatus);
}

/** Mensaje único para los dos backends y para el lote de importación. */
export function paidClaimRemovalMessage(refereeName?: string | null): string {
  const quien = refereeName?.trim() ? refereeName.trim() : "Ese juez";
  return `${quien} tiene la liquidación marcada como pagada: no se le puede quitar de la tarima. Si el cambio es real, revierte antes el pago en Compensación.`;
}

/** Igual, para vaciar la tarima entera. */
export function paidClaimClearAllMessage(count: number): string {
  return count === 1
    ? "Hay una liquidación pagada en esta tarima: no se puede vaciar. Revierte antes el pago en Compensación."
    : `Hay ${count} liquidaciones pagadas en esta tarima: no se puede vaciar. Revierte antes los pagos en Compensación.`;
}
