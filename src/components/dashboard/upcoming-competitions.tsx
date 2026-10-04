import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { daysUntil } from "@/lib/dashboard-intelligence";
import { coveragePct } from "@/lib/roster-coverage";
import type { Competition } from "@/lib/types";
import { STATUS_BAR as barColor, STATUS_TEXT as statusText } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function whenLabel(c: Competition): string {
  const start = daysUntil(c.fecha);
  if (start === null) return "";
  if (start < 0) return "en curso";
  if (start === 0) return "hoy";
  if (start === 1) return "mañana";
  if (start < 14) return `en ${start} días`;
  if (start < 60) return `en ${Math.round(start / 7)} semanas`;
  return `en ${Math.round(start / 30)} meses`;
}

/**
 * Próximos campeonatos con su cobertura real. Sustituye a tres paneles que
 * enseñaban la misma lista: «Radar operativo» (con un «riesgo 0–100»
 * inventado), «Previsión de cobertura» y la tabla del pie, que además leía la
 * cobertura guardada en la fila y no la calculada («5/9» frente a «15/45»).
 */
export function UpcomingCompetitions({ competitions }: { competitions: Competition[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border-muted px-4 py-3">
        <CardTitle>Próximos campeonatos</CardTitle>
        <Link
          href="/competitions"
          className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground focus-ring"
        >
          Ver todos
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </CardHeader>
      {competitions.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">No hay campeonatos programados.</p>
      ) : (
        <ul className="divide-y divide-border-muted">
          {competitions.map((c) => {
            const [, m, d] = c.fecha.split("-").map(Number);
            const pct = coveragePct(c.confirmados, c.requeridos);
            return (
              <li key={c.id}>
                <Link
                  href={`/competitions/${c.id}`}
                  className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="w-10 shrink-0 text-center leading-none" aria-hidden="true">
                    <p className="text-[11px] text-muted-foreground">{MONTHS[(m ?? 1) - 1]}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{d}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.nombre}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[c.tipo, c.sede, whenLabel(c)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="hidden w-36 shrink-0 sm:block">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className={statusText[c.estado]}>{c.estado}</span>
                      <span className="tabular-nums text-foreground-secondary">
                        {c.confirmados}/{c.requeridos}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-active"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                      aria-label={`Cobertura de ${c.nombre}: ${pct} %`}
                    >
                      <div className={cn("h-full rounded-full", barColor[c.estado])} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {/* Móvil: sin barra, la cifra basta. */}
                  <span className={cn("shrink-0 text-xs tabular-nums sm:hidden", statusText[c.estado])}>
                    {c.confirmados}/{c.requeridos}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
