import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ARBITRAJE_ROLE_LABELS } from "@/lib/judges-registry/arbitraje-stats";
import { currentSeasonYear } from "@/lib/season";
import type { RefereeArbitrajeStats } from "@/lib/types";

const TIERS: {
  key: keyof Pick<RefereeArbitrajeStats, "aep1" | "aep2" | "aep3">;
  label: string;
}[] = [
  { key: "aep3", label: "AEP-3" },
  { key: "aep2", label: "AEP-2" },
  { key: "aep1", label: "AEP-1" },
];

export function RefereeArbitrajePanel({ stats }: { stats: RefereeArbitrajeStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          Resumen importado ({currentSeasonYear()})
        </CardTitle>
        <p className="text-xs text-subtle-muted">
          Recuento agregado por rol, sin campeonato concreto:{" "}
          <span className="font-mono font-semibold text-foreground">{stats.total}</span>
          {stats.ipf > 0 && (
            <>
              {" "}
              · IPF: <span className="font-mono text-foreground">{stats.ipf}</span>
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {TIERS.map(({ key, label }) => {
          const entries = Object.entries(stats[key]).filter(([, n]) => n > 0);
          return (
            <TierBlock key={key} label={label} entries={entries} />
          );
        })}
      </CardContent>
    </Card>
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
