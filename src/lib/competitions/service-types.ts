/**
 * Errores de dominio del servicio de campeonatos, compartidos por los dos
 * backends (Supabase y memoria) para que las rutas API respondan igual en
 * ambos.
 */

/**
 * Se ha intentado eliminar un campeonato que tiene liquidaciones de dietas.
 *
 * La clave ajena `judge_compensation_claims.competition_id` nació con
 * `ON DELETE CASCADE` (024), de modo que borrar el campeonato se llevaba por
 * delante sus liquidaciones —incluidas las que ya estaban en `pagado`— sin
 * dejar rastro. Y no hacía falta que nadie pulsara «Eliminar»: la importación
 * de calendario deduplica sola, y el criterio de qué copia conservar solo mira
 * la tarima, no el dinero.
 */
export class CompetitionHasClaimsError extends Error {
  readonly claims: number;

  constructor(claims: number) {
    super(
      claims === 1
        ? "El campeonato tiene 1 liquidación de dietas asociada. Anúlala antes de eliminarlo."
        : `El campeonato tiene ${claims} liquidaciones de dietas asociadas. Anúlalas antes de eliminarlo.`,
    );
    this.name = "CompetitionHasClaimsError";
    this.claims = claims;
  }
}

/**
 * Se ha intentado eliminar un juez que tiene liquidaciones de dietas.
 *
 * Mismo caso que el campeonato: `judge_compensation_claims.referee_id` es
 * `ON DELETE CASCADE` (024:17), así que borrar la ficha del juez se llevaba por
 * delante su dinero, incluido el ya marcado como `pagado`, sin dejar rastro.
 */
export class RefereeHasClaimsError extends Error {
  readonly claims: number;

  constructor(claims: number) {
    super(
      claims === 1
        ? "El juez tiene 1 liquidación de dietas asociada. Anúlala antes de eliminarlo."
        : `El juez tiene ${claims} liquidaciones de dietas asociadas. Anúlalas antes de eliminarlo.`,
    );
    this.name = "RefereeHasClaimsError";
    this.claims = claims;
  }
}

/**
 * Otro usuario cambió el hueco mientras este lo editaba.
 *
 * La tarima es el recurso más disputado de la aplicación: dos delegados
 * revisando el mismo campeonato escriben sobre los mismos huecos. Sin este
 * corte, el segundo en llegar pisaba el trabajo del primero sin error, sin
 * aviso y sin dejar rastro de a quién había desplazado.
 */
export class RosterSlotConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RosterSlotConflictError";
  }
}

/**
 * El juez que saldría de la tarima tiene la liquidación pagada.
 *
 * El importe ya salió de la cuenta y corresponde a los servicios de esos
 * huecos: quitarlo deja un pago sin nada que lo respalde y un acta que no
 * cuadra con lo cobrado. Se para la operación y se pide revertir antes el pago.
 */
export class RosterPaidClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RosterPaidClaimError";
  }
}
