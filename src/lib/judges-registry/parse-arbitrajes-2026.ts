import type { RefereeArbitrajeStats } from "./arbitraje-stats";
import { arbitrajeStatsTotal, emptyArbitrajeStats } from "./arbitraje-stats";

type RoleKey =
  | "mesa"
  | "ordenador"
  | "lateral"
  | "central"
  | "control"
  | "resp"
  | "pesaje"
  | "montaje"
  | "jurado";

const AEP3_ROLES: RoleKey[] = [
  "mesa",
  "ordenador",
  "lateral",
  "central",
  "control",
  "resp",
  "pesaje",
  "montaje",
];
const AEP2_ROLES: RoleKey[] = [...AEP3_ROLES];
const AEP1_ROLES: RoleKey[] = [...AEP3_ROLES, "jurado"];

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.trunc(v));
  return 0;
}

function readTier(
  row: unknown[],
  start: number,
  roles: RoleKey[],
): Record<string, number> {
  const out: Record<string, number> = {};
  roles.forEach((role, i) => {
    const n = asNumber(row[start + i]);
    if (n > 0) out[role] = n;
  });
  return out;
}

/** Columnas: ID, Nombre, AEP3×8, AEP2×8, AEP1×9, IPF */
export function parseArbitrajes2026Sheet(
  rows: unknown[][],
): Map<number, RefereeArbitrajeStats> {
  const out = new Map<number, RefereeArbitrajeStats>();
  if (rows.length < 2) return out;

  for (const row of rows.slice(1)) {
    const id = asNumber(row[0]);
    if (!id) continue;

    const aep3 = readTier(row, 2, AEP3_ROLES);
    const aep2 = readTier(row, 10, AEP2_ROLES);
    const aep1 = readTier(row, 18, AEP1_ROLES);
    const ipf = asNumber(row[27]);

    const stats: RefereeArbitrajeStats = {
      aep1,
      aep2,
      aep3,
      ipf,
      total: 0,
    };
    stats.total = arbitrajeStatsTotal(stats);
    out.set(id, stats);
  }
  return out;
}

export function eventCountFromStats(stats: RefereeArbitrajeStats): number {
  return stats.total;
}

export { emptyArbitrajeStats };
