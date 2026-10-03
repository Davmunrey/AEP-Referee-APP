import { Card, CardContent } from "@/components/ui/card";
import { kpiAccentTokens, tokens } from "@/lib/design-tokens";
import type { DashboardKpi } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function KpiCards({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    // Columnas según cuántas tarjetas hay: con 4 en una rejilla de 5 quedaba un
    // hueco vacío al final de la fila.
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        kpis.length === 4 ? "xl:grid-cols-4" : "lg:grid-cols-3 xl:grid-cols-5",
      )}
    >
      {kpis.map((kpi) => {
        const style = kpiAccentTokens[kpi.accent];
        return (
          <Card key={kpi.label}>
            <CardContent className="flex h-full flex-col p-4">
              {/* El color se queda en un punto junto al rótulo: la cifra va en
                  el color del texto, que es lo que se lee de un vistazo. */}
              <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} aria-hidden="true" />
                {kpi.label}
              </p>
              <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
                {kpi.value}
              </p>
              <p className={cn("mb-3.5 mt-1.5 text-xs", tokens.text.subtle)}>{kpi.sub}</p>
              <div className="mt-auto flex items-center gap-1.5 border-t border-border-muted pt-3 text-xs text-muted-foreground">
                {kpi.trendDir === "up" && (
                  <ArrowUpRight className={cn("h-3.5 w-3.5 shrink-0", tokens.text.success)} aria-hidden="true" />
                )}
                {kpi.trendDir === "down" && (
                  <ArrowDownRight className={cn("h-3.5 w-3.5 shrink-0", tokens.text.destructive)} aria-hidden="true" />
                )}
                {kpi.trendDir === "warn" && (
                  <ArrowUpRight className={cn("h-3.5 w-3.5 shrink-0", tokens.text.warning)} aria-hidden="true" />
                )}
                {kpi.trendDir === "flat" && (
                  <Minus className={cn("h-3.5 w-3.5 shrink-0", tokens.text.subtle)} aria-hidden="true" />
                )}
                <span className="leading-snug">{kpi.trend}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
