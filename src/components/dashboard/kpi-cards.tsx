import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { kpiAccentTokens, tokens } from "@/lib/design-tokens";
import type { DashboardKpi } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function KpiCards({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const style = kpiAccentTokens[kpi.accent];
        return (
          <Card key={kpi.label} className={cn("overflow-hidden border", style.border, style.glow)}>
            <CardHeader className="flex flex-row items-center gap-2 pb-1">
              <span className={cn("h-2 w-2 rounded-full", style.dot)} />
              <CardTitle className={tokens.text.muted}>{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn("text-3xl font-bold tracking-tight", style.value)}>{kpi.value}</p>
              <p className={cn("mt-1.5 text-xs", tokens.text.subtle)}>{kpi.sub}</p>
              <p
                className={cn(
                  "mt-4 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs",
                  tokens.bg.surfaceHover,
                  tokens.text.muted,
                )}
              >
                {kpi.trendDir === "up" && <ArrowUpRight className={cn("h-3.5 w-3.5", tokens.text.success)} />}
                {kpi.trendDir === "down" && <ArrowDownRight className={cn("h-3.5 w-3.5", tokens.text.destructive)} />}
                {kpi.trendDir === "warn" && <ArrowUpRight className={cn("h-3.5 w-3.5", tokens.text.warning)} />}
                {kpi.trendDir === "flat" && <Minus className={cn("h-3.5 w-3.5", tokens.text.subtle)} />}
                <span className="leading-snug">{kpi.trend}</span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
