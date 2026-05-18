import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { daysUntil } from "@/lib/dashboard-intelligence";
import type { EventCoverage, EventStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import Link from "next/link";

const BAR_TONE: Record<EventStatus, string> = {
  Completo: "bg-success",
  Incompleto: "bg-warning",
  Crítico: "bg-destructive",
  Borrador: "bg-subtle",
};

const STATUS_TEXT: Record<EventStatus, string> = {
  Completo: "text-success",
  Incompleto: "text-warning",
  Crítico: "text-destructive",
  Borrador: "text-muted-foreground",
};

function dayLabel(d: number | null): { text: string; tone: string; pill: string } {
  if (d === null)
    return { text: "sin fecha", tone: "text-muted-foreground/60", pill: "bg-surface-hover text-muted-foreground/60" };
  if (d < 0)
    return { text: "finalizado", tone: "text-muted-foreground/60", pill: "bg-surface-hover text-muted-foreground/60" };
  if (d === 0)
    return { text: "hoy", tone: "text-destructive", pill: "bg-destructive-muted text-destructive border border-destructive/20" };
  if (d <= 7)
    return { text: `${d}d`, tone: "text-destructive", pill: "bg-destructive-muted text-destructive border border-destructive/20" };
  if (d <= 21)
    return { text: `${d}d`, tone: "text-warning", pill: "bg-warning-muted text-warning border border-warning/20" };
  return { text: `${d}d`, tone: "text-muted-foreground", pill: "bg-surface-hover text-muted-foreground" };
}

/** Previsión de cobertura — progreso de cada plantilla y tiempo restante. */
export function CoverageForecast({ coverage }: { coverage: EventCoverage[] }) {
  const upcoming = [...coverage]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 6);

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
          Previsión de cobertura
        </CardTitle>
        <Link
          href="/events"
          className="text-xs font-medium text-primary hover:text-primary/80"
        >
          Ver campeonatos →
        </Link>
      </CardHeader>
      <CardContent className="space-y-1 p-3">
        {upcoming.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground/60">
            Sin competiciones programadas.
          </p>
        )}
        {upcoming.map((c) => {
          const pct = c.required > 0 ? Math.round((c.filled / c.required) * 100) : 100;
          const day = dayLabel(daysUntil(c.fecha));
          return (
            <Link
              key={c.id}
              href={`/events/${c.id}`}
              className="group block rounded-xl p-2.5 transition-colors hover:bg-surface-hover"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {c.nombre}
                </span>
                {/* Days-until pill */}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
                    day.pill,
                  )}
                >
                  {day.text}
                </span>
              </div>

              {/* Progress bar — taller, rounded, with hover detail */}
              <div className="flex items-center gap-2.5">
                <div
                  className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-active"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Cobertura ${c.nombre}: ${pct}%, estado ${c.estado}`}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      BAR_TONE[c.estado],
                    )}
                    style={{ width: `${Math.max(pct, 3)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[11px] font-semibold",
                    STATUS_TEXT[c.estado],
                  )}
                >
                  {c.filled}/{c.required}
                </span>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
