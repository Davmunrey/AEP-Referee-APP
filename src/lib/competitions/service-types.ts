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
