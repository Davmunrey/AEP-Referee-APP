import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HealthStatus, OperationalHealth } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

const STATUS_STYLE: Record<
  HealthStatus,
  { ring: string; text: string; chipBg: string; track: string; bar: string }
> = {
  óptimo: {
    ring: "text-success",
    text: "text-success",
    chipBg: "bg-success-muted text-success",
    track: "text-success/10",
    bar: "bg-success",
  },
  estable: {
    ring: "text-info",
    text: "text-info-soft",
    chipBg: "bg-info-muted text-info-soft",
    track: "text-info/10",
    bar: "bg-info",
  },
  atención: {
    ring: "text-warning",
    text: "text-warning",
    chipBg: "bg-warning-muted text-warning",
    track: "text-warning/10",
    bar: "bg-warning",
  },
  crítico: {
    ring: "text-destructive",
    text: "text-destructive",
    chipBg: "bg-destructive-muted text-destructive",
    track: "text-destructive/10",
    bar: "bg-destructive",
  },
};

function factorTone(score: number): string {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-info";
  if (score >= 40) return "bg-warning";
  return "bg-destructive";
}

function factorText(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-info-soft";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

/** Anillo de salud operativa — índice 0–100 derivado del estado del panel. */
export function HealthGauge({ health }: { health: OperationalHealth }) {
  const style = STATUS_STYLE[health.status];
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = (health.score / 100) * circumference;

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted py-4">
        <CardTitle className="text-sm font-semibold">Salud operativa</CardTitle>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            style.chipBg,
          )}
        >
          {health.status}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-4 sm:flex-row sm:items-start">
        {/* Gauge ring */}
        <div className="relative mx-auto h-[126px] w-[126px] shrink-0 xl:h-[132px] xl:w-[132px]">
          <svg
            viewBox="0 0 128 128"
            className="h-full w-full -rotate-90"
            role="img"
            aria-label={`Índice de salud operativa: ${health.score} de 100, estado ${health.status}`}
          >
            {/* Track */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              strokeWidth="10"
              className={cn("text-current", style.track)}
              stroke="currentColor"
            />
            {/* Progress arc — CSS transition for smooth updates */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              className={style.ring}
              stroke="currentColor"
              strokeDasharray={`${dash} ${circumference}`}
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-[2rem] font-bold leading-none tracking-tight xl:text-[2.2rem]", style.text)}>
              {health.score}
            </span>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
              / 100
            </span>
            {typeof health.delta === "number" && (
              <span
                className={cn(
                  "mt-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  health.delta > 0
                    ? "bg-success-muted text-success"
                    : health.delta < 0
                      ? "bg-destructive-muted text-destructive"
                      : "text-muted-foreground/60",
                )}
              >
                {health.delta > 0 ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : health.delta < 0 ? (
                  <TrendingDown className="h-2.5 w-2.5" />
                ) : (
                  <Minus className="h-2.5 w-2.5" />
                )}
                {health.delta > 0 ? "+" : ""}
                {health.delta}
              </span>
            )}
          </div>
        </div>

        {/* Factors */}
        <div className="flex-1 space-y-1">
          <p className="mb-2.5 text-[12px] leading-relaxed text-muted-foreground">
            {health.summary}
          </p>
          <ul className="space-y-2.5">
            {health.factors.map((f) => (
              <li key={f.label}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-medium text-foreground/80">{f.label}</span>
                  <span className={cn("font-mono text-[11px] font-semibold", factorText(f.score))}>
                    {f.score}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-surface-active"
                  role="progressbar"
                  aria-valuenow={f.score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${f.label}: ${f.score} de 100`}
                >
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", factorTone(f.score))}
                    style={{ width: `${Math.max(f.score, 3)}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground/60">{f.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
