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
  { icon: LucideIcon; iconColor: string; chip: string; rail: string; rowBg: string }
> = {
  crítico: {
    icon: AlertOctagon,
    iconColor: "text-destructive",
    chip: "bg-destructive-muted text-destructive border-destructive/20",
    rail: "bg-destructive",
    rowBg: "bg-destructive-muted/30",
  },
  alerta: {
    icon: AlertTriangle,
    iconColor: "text-warning",
    chip: "bg-warning-muted text-warning border-warning/20",
    rail: "bg-warning",
    rowBg: "bg-warning-muted/20",
  },
  sugerencia: {
    icon: Lightbulb,
    iconColor: "text-info-soft",
    chip: "bg-info-muted text-info-soft border-info/20",
    rail: "bg-info",
    rowBg: "",
  },
  ok: {
    icon: CheckCircle2,
    iconColor: "text-success",
    chip: "bg-success-muted text-success border-success/20",
    rail: "bg-success",
    rowBg: "",
  },
};

/** Recomendaciones auto-generadas — el panel se retroalimenta de sus datos. */
export function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Recomendaciones
        </CardTitle>
        <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {insights.length} {insights.length === 1 ? "sugerencia" : "sugerencias"}
        </span>
      </CardHeader>
      <CardContent className="divide-y divide-border-muted p-0">
        {insights.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-success/60" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground/70">Todo en orden</p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">
                No hay recomendaciones pendientes.
              </p>
            </div>
          </div>
        )}
        {insights.map((insight) => {
          const s = SEVERITY[insight.severity];
          const Icon = s.icon;
          return (
            <div
              key={insight.id}
              className={cn("flex gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover", s.rowBg)}
            >
              {/* Severity rail */}
              <span aria-hidden="true" className={cn("mt-0.5 w-1 shrink-0 rounded-full", s.rail)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                  <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", s.iconColor)} aria-hidden="true" />
                  <span className="sr-only">{insight.severity}:</span>
                  <p className="flex-1 text-[13px] font-semibold leading-snug text-foreground">
                    {insight.title}
                  </p>
                  {insight.metric && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold",
                        s.chip,
                      )}
                    >
                      {insight.metric}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                  {insight.detail}
                </p>
                {insight.action && (
                  <Link
                    href={insight.action.href}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
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
