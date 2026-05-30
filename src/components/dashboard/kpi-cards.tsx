import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { kpiAccentTokens, tokens } from "@/lib/design-tokens";
import type { DashboardKpi } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

/** CSS-only micro-trend: 5 bars with varying heights giving a sparkline feel. */
function MicroTrend({ dir }: { dir: DashboardKpi["trendDir"] }) {
  const barHeights =
    dir === "up"
      ? [2, 4, 3, 5, 7]
      : dir === "down"
        ? [7, 5, 6, 3, 2]
        : dir === "warn"
          ? [3, 5, 7, 5, 6]
          : [4, 4, 4, 4, 4];

  const barColor =
    dir === "up"
      ? "bg-success"
      : dir === "down"
        ? "bg-destructive"
        : dir === "warn"
          ? "bg-warning"
          : "bg-subtle";

  return (
    <div className="flex items-end gap-0.5" aria-hidden="true">
      {barHeights.map((h, i) => (
        <span
          key={i}
          className={cn("w-1 rounded-sm opacity-70", barColor)}
          style={{ height: `${h * 2}px` }}
        />
      ))}
    </div>
  );
}

export function KpiCards({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const style = kpiAccentTokens[kpi.accent];
        return (
          <Card key={kpi.label} className={cn("overflow-hidden border", style.border, style.glow)}>
            {/* Accent top strip */}
            <div className={cn("h-0.5 w-full", style.dot)} />
            <CardHeader className="flex flex-row items-center gap-2 pb-1 pt-3.5">
              <CardTitle className={cn("text-xs font-medium uppercase tracking-wider", tokens.text.muted)}>
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3.5 pt-0">
              {/* Big number — strong hierarchy */}
              <p className={cn("text-[1.7rem] font-bold tabular-nums tracking-tight xl:text-[1.85rem] 2xl:text-[2.2rem]", style.value)}>
                {kpi.value}
              </p>
              <p className={cn("mt-1 text-[11px]", tokens.text.subtle)}>{kpi.sub}</p>

              {/* Trend row */}
              <div
                className={cn(
                  "mt-3 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5",
                  tokens.bg.surfaceHover,
                )}
              >
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {kpi.trendDir === "up" && (
                    <ArrowUpRight className={cn("h-3.5 w-3.5", tokens.text.success)} />
                  )}
                  {kpi.trendDir === "down" && (
                    <ArrowDownRight className={cn("h-3.5 w-3.5", tokens.text.destructive)} />
                  )}
                  {kpi.trendDir === "warn" && (
                    <ArrowUpRight className={cn("h-3.5 w-3.5", tokens.text.warning)} />
                  )}
                  {kpi.trendDir === "flat" && (
                    <Minus className={cn("h-3.5 w-3.5", tokens.text.subtle)} />
                  )}
                  <span className="leading-snug">{kpi.trend}</span>
                </div>
                <MicroTrend dir={kpi.trendDir} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
