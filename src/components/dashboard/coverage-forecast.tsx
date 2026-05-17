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

function dayLabel(d: number | null): { text: string; tone: string } {
  if (d === null) return { text: "sin fecha", tone: "text-subtle-muted" };
  if (d < 0) return { text: "finalizado", tone: "text-subtle-muted" };
  if (d === 0) return { text: "hoy", tone: "text-destructive" };
  if (d <= 7) return { text: `${d} d`, tone: "text-destructive" };
  if (d <= 21) return { text: `${d} d`, tone: "text-warning" };
  return { text: `${d} d`, tone: "text-muted-foreground" };
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
          <CalendarClock className="h-4 w-4 text-primary" />
          Previsión de cobertura
        </CardTitle>
        <Link
          href="/events"
          className="text-xs font-medium text-primary hover:text-primary-soft"
        >
          Ver eventos →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3.5 p-5">
        {upcoming.length === 0 && (
          <p className="py-4 text-center text-xs text-subtle-muted">
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
              className="block rounded-xl p-2 transition-colors hover:bg-surface-hover"
            >
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {c.nombre}
                </span>
                <span className={cn("shrink-0 font-mono text-[11px] font-semibold", day.tone)}>
                  {day.text}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-surface-active"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Cobertura ${c.nombre}: ${pct}%, estado ${c.estado}`}
                >
                  <div
                    className={cn("h-full rounded-full transition-all", BAR_TONE[c.estado])}
                    style={{ width: `${Math.max(pct, 3)}%` }}
                  />
                </div>
                <span className="shrink-0 font-mono text-[11px] text-subtle-muted">
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
