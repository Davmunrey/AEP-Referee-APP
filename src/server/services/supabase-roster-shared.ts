/** Piezas comunes de los servicios de la tarima en Supabase. */
import { isSlotKeyInTemplate, validateAssignment } from "@/lib/roster-rules";
import type {
  AssignValidation,
  Competition,
  Referee,
  RoleKey,
  RosterSession,
  SlotFlags,
} from "@/lib/types";
import { ApprovalReviewError } from "@/lib/competitions/service-types";
import { db, parseSlotKey } from "./supabase-helpers";

/** Entrada de una asignación dentro de un lote de importación. */
export interface RosterBatchAssignment {
  slotKey: string;
  refereeId: string;
  flags?: SlotFlags;
  crossZoneReason?: string;
}

/**
 * Arranca una lectura YA, en paralelo con las demás, pero aparca su error hasta
 * que el código llega al punto donde antes la hacía en serie. Así se ahorra el
 * round-trip sin cambiar qué error gana: un 409 o un «no existe» que antes
 * salían antes de esta lectura siguen saliendo aunque ella haya fallado (y su
 * rechazo nunca queda sin manejar).
 */
export function startRead<T>(promise: Promise<T>): () => Promise<T> {
  const settled = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  return async () => {
    const result = await settled;
    if (!result.ok) throw result.error;
    return result.value;
  };
}

/**
 * Núcleo puro de validateAssign: mismos checks, mismo orden y mismos mensajes,
 * pero sobre datos ya cargados (competición, juez y plantilla). Permite validar
 * sin volver a golpear la base de datos cuando el llamante ya tiene los datos.
 */
export function validateAssignWithData(
  comp: Competition | undefined,
  referee: Referee | undefined,
  slotKey: string,
  template: RosterSession[],
): AssignValidation {
  if (!comp || !referee) return { ok: false, error: "Datos no válidos" };
  const parsed = parseSlotKey(slotKey);
  if (!parsed) return { ok: false, error: "Slot inválido" };
  if (!isSlotKeyInTemplate(template, slotKey)) {
    return { ok: false, error: "El hueco no existe en la plantilla del campeonato" };
  }
  return validateAssignment(referee, parsed.roleKey as RoleKey, comp.tipo);
}

/**
 * Marca el resultado de la revisión en el campeonato.
 *
 * El error de este UPDATE se descartaba: la propuesta quedaba aprobada y el
 * acta guardada, pero el campeonato seguía en «Propuesta enviada» e
 * «Incompleto» sin que nadie se enterara — y reintentar la revisión ya no
 * sirve, porque la propuesta ha dejado de estar pendiente. Un reintento cubre
 * el fallo pasajero; si tampoco sale, se dice exactamente qué quedó a medias.
 */
export async function markCompetitionReviewed(
  competitionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const supabase = db();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.from("competitions").update(patch).eq("id", competitionId);
    if (!error) return;
    if (attempt === 1) {
      // El detalle de Postgres se queda en el log del servidor: al revisor se
      // le dice qué quedó a medias, no el nombre de la tabla que falló.
      console.error("[roster.markCompetitionReviewed]", competitionId, error.message);
      throw new ApprovalReviewError(
        "La revisión se guardó y el acta también, pero el campeonato no llegó a marcarse. Su estado en el listado no refleja la revisión; avisa antes de volver a tocarlo.",
      );
    }
  }
}
