import { EventStatusBadge } from "@/components/aep/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { daysUntil } from "@/lib/dashboard-intelligence";
import type { EventCoverage } from "@/lib/types";
import { cn, formatDateRange } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Flame,
  TimerReset,
} from "lucide-react";
import Link from "next/link";

type RadarItem = EventCoverage & {
  days: number | null;
  pct: number;
  risk: number;
  action: string;
};

function riskScore(c: EventCoverage, days: number | null) {
  const openPressure = Math.min(60, c.open * 9);
  const timePressure =
    days === null
      ? 10
      : days < 0
        ? 0
        : days === 0
          ? 45
          : days <= 7
            ? 36
            : days <= 21
              ? 22
              : 8;
  const statusPressure =
    c.estado === "Crítico"
      ? 34
      : c.estado === "Incompleto"
        ? 18
        : c.estado === "Borrador"
          ? 12
          : 0;

  return Math.min(100, openPressure + timePressure + statusPressure);
}

function actionFor(c: EventCoverage, days: number | null) {
  if (c.open <= 0) return "Verificar cierre";
  if (c.estado === "Crítico") return "Cubrir huecos";
  if (days !== null && days <= 7) return "Cerrar hoy";
  if (c.estado === "Borrador") return "Validar plantilla";
  return "Planificar";
}

function dayText(days: number | null) {
  if (days === null) return "Sin fecha";
  if (days < 0) return "Histórico";
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `${days} días`;
}

function buildRadar(coverage: EventCoverage[]): RadarItem[] {
  return coverage
    .map((c) => {
      const days = daysUntil(c.fecha);
      const pct = c.required > 0 ? Math.round((c.filled / c.required) * 100) : 100;
      return {
        ...c,
        days,
        pct,
        risk: riskScore(c, days),
        action: actionFor(c, days),
      };
    })
    .filter((c) => c.days === null || c.days >= 0)
    .sort((a, b) => b.risk - a.risk || a.fecha.localeCompare(b.fecha))
    .slice(0, 5);
}

function riskTone(risk: number) {
  if (risk >= 78) return "text-destructive bg-destructive-muted border-destructive/20";
  if (risk >= 48) return "text-warning bg-warning-muted border-warning/20";
  return "text-success bg-success-muted border-success/20";
}

/** Radar operativo: convierte cobertura en orden de trabajo accionable. */
export function PriorityRadar({ coverage }: { coverage: EventCoverage[] }) {
  const items = buildRadar(coverage);
  const leader = items[0];

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Flame className="h-4 w-4 text-primary" aria-hidden="true" />
          Radar operativo
        </CardTitle>
        <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Próxima acción
        </span>
      </CardHeader>

      <CardContent className="space-y-3 p-3">
        {!leader && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-success/60" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">Sin bloqueos activos</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No hay campeonatos próximos que requieran acción.
              </p>
            </div>
          </div>
        )}

        {leader && (
          <Link
            href={`/competitions/${leader.id}`}
            className="group block rounded-2xl border border-primary/15 bg-primary/5 p-4 transition-colors hover:bg-primary/10 focus-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums",
                      riskTone(leader.risk),
                    )}
                  >
                    Riesgo {leader.risk}
                  </span>
                  <EventStatusBadge status={leader.estado} />
                </div>
                <p className="truncate text-base font-semibold text-foreground">
                  {leader.nombre}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDateRange(leader.fecha, leader.fecha)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <TimerReset className="h-3.5 w-3.5" aria-hidden="true" />
                    {dayText(leader.days)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    {leader.open} hueco{leader.open === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="shrink-0 rounded-xl bg-background/70 px-3 py-2 text-right">
                <p className="font-mono text-lg font-bold tabular-nums text-foreground">
                  {leader.filled}/{leader.required}
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  cubierto
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                <div
                  className={cn(
                    "h-full rounded-full",
                    leader.pct >= 100
                      ? "bg-success"
                      : leader.risk >= 78
                        ? "bg-destructive"
                        : "bg-warning",
                  )}
                  style={{ width: `${Math.max(leader.pct, 4)}%` }}
                />
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                {leader.action}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        )}

        {items.slice(1).map((item, index) => (
          <Link
            key={item.id}
            href={`/competitions/${item.id}`}
            className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface-hover focus-ring"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-hover font-mono text-xs font-bold text-muted-foreground">
              {index + 2}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {item.nombre}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {dayText(item.days)} · {item.open} hueco
                {item.open === 1 ? "" : "s"} · {item.action}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums",
                riskTone(item.risk),
              )}
            >
              {item.risk}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
