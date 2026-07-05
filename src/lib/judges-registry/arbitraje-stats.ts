/** Recuento de posiciones por tipo de campeonato (una hoja ArbitrajesAAAA). */
export interface RefereeArbitrajeStats {
  aep1: Record<string, number>;
  aep2: Record<string, number>;
  aep3: Record<string, number>;
  ipf: number;
  total: number;
}

/** Arbitrajes desglosados por año natural: { "2024": {…}, "2025": {…}, … }. */
export type RefereeArbitrajeStatsByYear = Record<string, RefereeArbitrajeStats>;

export const ARBITRAJE_ROLE_LABELS: Record<string, string> = {
  central: "Central",
  lateral: "Lateral",
  ordenador: "Ordenador",
  mesa: "Mesa",
  control: "Control",
  resp: "Resp.",
  pesaje: "Pesaje",
  montaje: "Montaje",
  jurado: "Jurado",
};

export function emptyArbitrajeStats(): RefereeArbitrajeStats {
  return { aep1: {}, aep2: {}, aep3: {}, ipf: 0, total: 0 };
}

export function sumRoleMap(map: Record<string, number>): number {
  return Object.values(map).reduce((a, n) => a + n, 0);
}

export function arbitrajeStatsTotal(stats: RefereeArbitrajeStats): number {
  return (
    sumRoleMap(stats.aep1) +
    sumRoleMap(stats.aep2) +
    sumRoleMap(stats.aep3) +
    stats.ipf
  );
}

function mergeRoleMaps(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [role, n] of Object.entries(b)) out[role] = (out[role] ?? 0) + n;
  return out;
}

/** Suma los arbitrajes de todos los años naturales en un único agregado. */
export function aggregateArbitrajeYears(
  byYear: RefereeArbitrajeStatsByYear,
): RefereeArbitrajeStats {
  const agg = emptyArbitrajeStats();
  for (const stats of Object.values(byYear)) {
    agg.aep1 = mergeRoleMaps(agg.aep1, stats.aep1);
    agg.aep2 = mergeRoleMaps(agg.aep2, stats.aep2);
    agg.aep3 = mergeRoleMaps(agg.aep3, stats.aep3);
    agg.ipf += stats.ipf;
  }
  agg.total = arbitrajeStatsTotal(agg);
  return agg;
}

/** Años naturales con al menos un arbitraje, ordenados desc (el más reciente primero). */
export function arbitrajeYears(byYear: RefereeArbitrajeStatsByYear): number[] {
  return Object.keys(byYear)
    .map((y) => Number(y))
    .filter((y) => Number.isFinite(y) && (byYear[String(y)]?.total ?? 0) > 0)
    .sort((a, b) => b - a);
}

/** Top roles across AEP tiers for compact UI. */
export function topArbitrajeRoles(
  stats: RefereeArbitrajeStats,
  limit = 3,
): { role: string; count: number }[] {
  const merged = new Map<string, number>();
  for (const tier of [stats.aep1, stats.aep2, stats.aep3] as const) {
    for (const [role, n] of Object.entries(tier)) {
      if (n > 0) merged.set(role, (merged.get(role) ?? 0) + n);
    }
  }
  return [...merged.entries()]
    .map(([role, count]) => ({
      role: ARBITRAJE_ROLE_LABELS[role] ?? role,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
