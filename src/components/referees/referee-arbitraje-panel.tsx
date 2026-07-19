"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ARBITRAJE_ROLE_LABELS,
  arbitrajeYears,
} from "@/lib/judges-registry/arbitraje-stats";
import type { RefereeArbitrajeStats, RefereeArbitrajeStatsByYear } from "@/lib/types";

const TIERS: {
  key: keyof Pick<RefereeArbitrajeStats, "aep1" | "aep2" | "aep3">;
  label: string;
}[] = [
  { key: "aep3", label: "AEP-3" },
  { key: "aep2", label: "AEP-2" },
  { key: "aep1", label: "AEP-1" },
];

/** Valor especial del selector: agregado histórico de todos los años. */
const ALL_YEARS = "all";

export function RefereeArbitrajePanel({
  stats,
  byYear,
}: {
  /** Agregado histórico (suma de todos los años naturales). */
  stats: RefereeArbitrajeStats;
  /** Desglose por año natural, si está disponible. */
  byYear?: RefereeArbitrajeStatsByYear;
}) {
  const years = useMemo(() => (byYear ? arbitrajeYears(byYear) : []), [byYear]);
  const hasYears = years.length > 0;
  // Por defecto, el año natural más reciente con actividad (censo vigente);
  // "Histórico" agrega todos los años.
  const [selected, setSelected] = useState<string>(
    hasYears ? String(years[0]) : ALL_YEARS,
  );

  const active: RefereeArbitrajeStats =
    selected === ALL_YEARS || !byYear ? stats : byYear[selected] ?? stats;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Arbitrajes por rol</CardTitle>
          {hasYears && (
            <div
              className="flex flex-wrap gap-1"
              role="group"
              aria-label="Año natural de arbitrajes"
            >
              {years.map((year) => (
                <YearChip
                  key={year}
                  label={String(year)}
                  active={selected === String(year)}
                  onClick={() => setSelected(String(year))}
                />
              ))}
              <YearChip
                label="Histórico"
                active={selected === ALL_YEARS}
                onClick={() => setSelected(ALL_YEARS)}
              />
            </div>
          )}
        </div>
        <p className="text-xs text-subtle-muted">
          {selected === ALL_YEARS
            ? "Total histórico (todos los años naturales)"
            : `Año natural ${selected}`}
          : <span className="font-mono font-semibold text-foreground">{active.total}</span>
          {active.ipf > 0 && (
            <>
              {" "}
              · IPF: <span className="font-mono text-foreground">{active.ipf}</span>
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {TIERS.map(({ key, label }) => {
          const entries = Object.entries(active[key]).filter(([, n]) => n > 0);
          return <TierBlock key={key} label={label} entries={entries} />;
        })}
      </CardContent>
    </Card>
  );
}

function YearChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-ring ${
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-subtle-muted hover:bg-surface-hover"
      }`}
    >
      {label}
    </button>
  );
}

function TierBlock({
  label,
  entries,
}: {
  label: string;
  entries: [string, number][];
}) {
  return (
    <div className="rounded-lg border border-border-muted bg-surface/50 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
        {label}
      </p>
      {entries.length === 0 ? (
        <p className="text-xs text-subtle-muted">Sin asignaciones</p>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {entries.map(([role, count]) => (
              <tr
                key={role}
                className="border-b border-border-muted/50 last:border-0"
              >
                <td className="py-1 pr-2 text-foreground-secondary">
                  {ARBITRAJE_ROLE_LABELS[role] ?? role}
                </td>
                <td className="py-1 text-right font-mono font-semibold text-foreground">
                  {count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
