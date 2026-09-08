import type { CompensationClaim } from "@/lib/judge-compensation/types";
import { blocksRosterRemoval } from "@/lib/roster-paid-claims";

// Colgado de globalThis como el store principal (store.ts): en dev con HMR y
// bundles por ruta cada instancia del módulo tendría su propio Map y las
// claims guardadas desde una ruta no se verían desde otra.
//
// Vive en su propio módulo, y no dentro de `memory-compensation`, porque la
// tarima necesita consultarlo para congelar a los jueces ya pagados y
// `memory-compensation` ya importa `memory-competitions`: tenerlo allí cerraba
// un ciclo entre los dos módulos.
const globalForCompensation = globalThis as unknown as {
  __aepCompensationStore?: Map<string, CompensationClaim>;
};

export const compensationStore = (globalForCompensation.__aepCompensationStore ??= new Map<
  string,
  CompensationClaim
>());

export function compensationClaimKey(competitionId: string, refereeId: string): string {
  return `${competitionId}::${refereeId}`;
}

/** Jueces de la competición con la liquidación en un estado que congela su puesto. */
export function paidClaimRefereeIds(competitionId: string): Set<string> {
  const ids = new Set<string>();
  const prefix = `${competitionId}::`;
  for (const [key, claim] of compensationStore) {
    if (!key.startsWith(prefix)) continue;
    if (blocksRosterRemoval(claim.status)) ids.add(claim.refereeId);
  }
  return ids;
}
