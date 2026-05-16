import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Insight, InsightSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

const SEVERITY: Record<
  InsightSeverity,
  { icon: LucideIcon; iconColor: string; chip: string; rail: string }
> = {
  crítico: {
    icon: AlertOctagon,
    iconColor: "text-destructive",
    chip: "bg-destructive-muted text-destructive",
    rail: "bg-destructive",
  },
  alerta: {
    icon: AlertTriangle,
    iconColor: "text-warning",
    chip: "bg-warning-muted text-warning",
    rail: "bg-warning",
  },
  sugerencia: {
    icon: Lightbulb,
    iconColor: "text-info-soft",
    chip: "bg-info-muted text-info-soft",
    rail: "bg-info",
  },
  ok: {
    icon: CheckCircle2,
    iconColor: "text-success",
    chip: "bg-success-muted text-success",
    rail: "bg-success",
  },
};

/** Recomendaciones auto-generadas — el panel se retroalimenta de sus datos. */
export function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Recomendaciones
        </CardTitle>
        <span className="text-[11px] text-subtle-muted">
          {insights.length} sugerencia{insights.length === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardContent className="divide-y divide-border-muted p-0">
        {insights.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-subtle-muted">
            Sin recomendaciones.
          </p>
        )}
        {insights.map((insight) => {
          const s = SEVERITY[insight.severity];
          const Icon = s.icon;
          return (
            <div key={insight.id} className="flex gap-3 px-4 py-3.5">
              <span className={cn("mt-0.5 w-1 shrink-0 rounded-full", s.rail)} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", s.iconColor)} />
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {insight.title}
                  </p>
                  {insight.metric && (
                    <span
                      className={cn(
                        "ml-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
                        s.chip,
                      )}
                    >
                      {insight.metric}
                    </span>
                  )}
                </div>
                <p className="text-[12px] leading-snug text-muted-foreground">
                  {insight.detail}
                </p>
                {insight.action && (
                  <Link
                    href={insight.action.href}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:text-primary-soft"
                  >
                    {insight.action.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
