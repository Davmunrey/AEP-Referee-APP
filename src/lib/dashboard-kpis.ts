/**
 * Indicadores del panel de inicio.
 *
 * Una sola función para los dos backends. Antes cada gemelo montaba los suyos:
 * el de Supabase devolvía cinco y el de memoria cuatro, con textos distintos, y
 * las plazas sin cubrir se contaban con `countOpenSlots` sobre la plantilla, sin
 * el respaldo de `requeridos` que sí usa la cobertura. Un campeonato sin
 * plantilla (6 plazas) contaba 0 en el indicador y 6 en la previsión de al
 * lado: «30 plazas sin cubrir» frente a 15 + … = 36.
 *
 * Ahora todo sale de `coverage`, que es la cobertura viva de cada campeonato
 * vigente (misma fórmula que la tarima y la analítica).
 */
import { coveragePct } from "@/lib/roster-coverage";
import { contar, palabra } from "@/lib/plural";
import type { DashboardKpi, EventCoverage } from "@/lib/types";

export interface DashboardKpiInput {
  coverage: Pick<EventCoverage, "open" | "required" | "estado">[];
  referees: { estado: string }[];
  approvals: { status: string }[];
}

export function buildDashboardKpis({ coverage, referees, approvals }: DashboardKpiInput): DashboardKpi[] {
  const open = coverage.reduce((a, c) => a + c.open, 0);
  const required = coverage.reduce((a, c) => a + c.required, 0);
  const critical = coverage.filter((c) => c.estado === "Crítico").length;
  const pending = approvals.filter((a) => a.status === "pendiente").length;
  const active = referees.filter((r) => r.estado === "Activo").length;

  return [
    {
      id: "openSlots",
      label: "Plazas sin cubrir",
      value: String(open),
      sub:
        required > 0
          ? `de ${required} · ${coveragePct(required - open, required)} % cubierto`
          : "sin plazas que cubrir",
      tone: open === 0 ? "default" : critical > 0 ? "critical" : "warning",
      href: "/competitions",
    },
    {
      id: "upcoming",
      label: "Próximos campeonatos",
      value: String(coverage.length),
      sub: critical > 0 ? contar(critical, "en estado crítico", "en estado crítico") : "ninguno en estado crítico",
      tone: critical > 0 ? "critical" : "default",
      href: "/competitions",
    },
    {
      id: "approvals",
      label: "Aprobaciones pendientes",
      value: String(pending),
      sub: pending > 0 ? `${palabra(pending, "espera", "esperan")} revisión nacional` : "bandeja al día",
      tone: pending > 0 ? "warning" : "default",
      href: "/approvals",
    },
    {
      id: "referees",
      label: "Jueces activos",
      value: String(active),
      sub: `de ${referees.length} federados`,
      tone: "default",
      href: "/referees",
    },
  ];
}
