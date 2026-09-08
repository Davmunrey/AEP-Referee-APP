import type { CompensationClaim } from "./types";

/**
 * Liquidaciones guardadas de jueces que ya no están en la tarima y que se
 * pueden recoger al recalcular.
 *
 * El resumen conserva y marca las huérfanas a propósito —esconder un importe
 * registrado es peor que enseñarlo fuera de sitio—, pero el recálculo las
 * borraba todas sin mirar el estado: la liquidación pagada o aprobada de un
 * juez sustituido desaparecía de la base, esta vez sin quedar ni a la vista.
 *
 * Solo se recoge lo que no compromete dinero: el borrador, que es lo que el
 * recálculo habría vuelto a generar de todas formas si el juez siguiera en la
 * tarima.
 */
export function isDiscardableOrphanClaim(claim: Pick<CompensationClaim, "status">): boolean {
  return claim.status === "borrador";
}

/** Ids de fila a borrar: huérfanas y sin dinero comprometido. */
export function discardableOrphanClaimIds(
  stored: ReadonlyMap<string, CompensationClaim>,
  activeRefereeIds: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  for (const [refereeId, claim] of stored) {
    if (activeRefereeIds.has(refereeId)) continue;
    if (!isDiscardableOrphanClaim(claim)) continue;
    ids.push(claim.id);
  }
  return ids;
}
