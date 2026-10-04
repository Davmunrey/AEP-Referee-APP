import { MetricStrip, MetricTile, type MetricTone } from "@/components/ui/metric-tile";
import type { DashboardKpi } from "@/lib/types";

const TONE: Record<DashboardKpi["tone"], MetricTone> = {
  default: "neutral",
  warning: "warning",
  critical: "danger",
};

/**
 * Las cuatro cifras del panel de inicio. Es la misma franja que el resto de
 * pantallas: el color se reserva para la cifra que pide hacer algo.
 */
export function KpiCards({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    <MetricStrip label="Indicadores">
      {kpis.map((kpi) => (
        <MetricTile
          key={kpi.id}
          label={kpi.label}
          value={kpi.value}
          hint={kpi.sub}
          tone={TONE[kpi.tone]}
          href={kpi.href}
        />
      ))}
    </MetricStrip>
  );
}
