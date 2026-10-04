import Link from "next/link";
import type { DashboardKpi } from "@/lib/types";
import { cn } from "@/lib/utils";

const toneText: Record<DashboardKpi["tone"], string> = {
  default: "text-muted-foreground",
  warning: "text-warning",
  critical: "text-destructive",
};

/**
 * Una franja con cuatro cifras. Antes eran cuatro tarjetas idénticas con punto
 * de color, separador y una flecha «↗ temporada 2026» que no medía nada: el
 * color se reserva ahora para la cifra que pide hacer algo.
 */
export function KpiCards({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    <section
      aria-label="Indicadores"
      className="surface-card grid grid-cols-2 overflow-hidden rounded-xl lg:grid-cols-4"
    >
      {kpis.map((kpi, i) => {
        const body = (
          <>
            <p className="text-[13px] text-muted-foreground">{kpi.label}</p>
            <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
              {kpi.value}
            </p>
            <p className={cn("mt-1.5 text-xs", toneText[kpi.tone])}>{kpi.sub}</p>
          </>
        );
        const cell = cn(
          "block min-w-0 px-4 py-3.5 sm:px-5",
          // Separadores: verticales entre columnas y horizontal entre filas en
          // la rejilla de 2×2.
          i % 2 === 1 && "border-l border-border-muted",
          i >= 2 && "border-t border-border-muted lg:border-t-0",
          i === 2 && "lg:border-l",
        );
        return kpi.href ? (
          <Link key={kpi.id} href={kpi.href} className={cn(cell, "transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring")}>
            {body}
          </Link>
        ) : (
          <div key={kpi.id} className={cell}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
