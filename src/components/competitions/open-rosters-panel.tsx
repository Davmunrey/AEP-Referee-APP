import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CoverageBar } from "@/components/competitions/coverage-bar";
import { listActiveTarimaCompetitions, rosterCoveragePct } from "@/lib/roster-active";
import { STATUS_TEXT } from "@/lib/status-tone";
import type { Competition } from "@/lib/types";
import { formatDateRange } from "@/lib/utils";

interface OpenRostersPanelProps {
  competitions: Competition[];
  maxItems?: number;
}

/**
 * Tarimas que aún piden trabajo, de la menos cubierta a la más. Antes eran
 * tarjetas iguales (insignias, fecha ISO, barra roja y botón) que repetían la
 * tabla de debajo e incluían tarimas ya completas. Ahora son filas: solo las
 * que tienen huecos o no tienen plantilla, con lo que falta como dato principal.
 */
export function OpenRostersPanel({ competitions, maxItems = 5 }: OpenRostersPanelProps) {
  const needsWork = listActiveTarimaCompetitions(competitions).filter(
    (c) => c.requeridos <= 0 || c.confirmados < c.requeridos,
  );
  if (needsWork.length === 0) return null;
  const shown = needsWork.slice(0, maxItems);

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-baseline justify-between gap-3 space-y-0 border-b border-border-muted px-4 py-3">
        <CardTitle className="text-sm font-semibold">Tarimas por completar</CardTitle>
        <span className="text-xs tabular-nums text-muted-foreground">
          {needsWork.length > shown.length ? `${shown.length} de ${needsWork.length}` : needsWork.length}
        </span>
      </CardHeader>
      <ul className="divide-y divide-border-muted">
        {shown.map((c) => {
          const pct = rosterCoveragePct(c);
          const missing = Math.max(0, c.requeridos - c.confirmados);
          return (
            <li key={c.id}>
              <Link
                href={`/competitions/${c.id}`}
                className="group flex min-h-11 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{c.nombre}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {formatDateRange(c.fecha, c.fechaFin)} · {c.tipo}
                  </p>
                </div>
                <div className="hidden w-32 shrink-0 sm:block">
                  <p className="text-right text-xs tabular-nums text-foreground-secondary">
                    {c.confirmados}/{c.requeridos}
                  </p>
                  <CoverageBar
                    pct={pct}
                    estado={c.estado}
                    label={`Cobertura de ${c.nombre}: ${pct} %`}
                    className="mt-1.5"
                  />
                </div>
                {/* Lo que falta es lo que el delegado necesita saber; el
                    porcentaje ya lo dice la barra. */}
                <span className={`w-24 shrink-0 text-right text-xs font-medium tabular-nums ${STATUS_TEXT[c.estado]}`}>
                  {c.requeridos <= 0 ? "Sin plantilla" : `Faltan ${missing}`}
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-subtle transition-colors group-hover:text-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
