/**
 * Motor de inteligencia del panel — capa de retroalimentación.
 *
 * Lee el estado operativo (jueces, competiciones, cobertura, aprobaciones)
 * y deriva por sí mismo un índice de salud y recomendaciones priorizadas.
 * No requiere entrada manual: el panel se alimenta de sus propios datos.
 */
import type {
  ActivityItem,
  Competition,
  EventCoverage,
  HealthFactor,
  HealthStatus,
  Insight,
  InsightSeverity,
  OperationalHealth,
} from "@/lib/types";

export interface IntelligenceInput {
  referees: { estado: string; disp?: boolean }[];
  competitions: Competition[];
  approvals: { status: string }[];
  promotions: { status: string }[];
  coverage: EventCoverage[];
  activity: ActivityItem[];
}

export interface DashboardIntelligence {
  health: OperationalHealth;
  insights: Insight[];
}

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  crítico: 0,
  alerta: 1,
  sugerencia: 2,
  ok: 3,
};

/** Días desde hoy hasta una fecha ISO; null si la fecha no es válida. */
export function daysUntil(iso: string, now = new Date()): number | null {
  // Parseo por componentes (no `new Date(iso)`): una fecha solo-día se
  // interpretaría como UTC y, leída en local, se desplaza un día en husos
  // negativos (el cliente puede estar fuera de España).
  const [y, mo, d] = String(iso).split(/[-T]/).map(Number);
  if (!y || !mo || !d) return null;
  const day = new Date(y, mo - 1, d);
  if (Number.isNaN(day.getTime()) || day.getMonth() !== mo - 1) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function statusFromScore(score: number): HealthStatus {
  if (score >= 85) return "óptimo";
  if (score >= 70) return "estable";
  if (score >= 50) return "atención";
  return "crítico";
}

/** Construye el índice de salud operativa ponderado (0–100). */
function buildHealth(input: IntelligenceInput, now: Date): OperationalHealth {
  const { referees, coverage, approvals } = input;

  const totalReq = coverage.reduce((a, c) => a + c.required, 0);
  const totalFilled = coverage.reduce((a, c) => a + c.filled, 0);
  const coveragePct = totalReq > 0 ? (totalFilled / totalReq) * 100 : 100;

  const totalEvents = coverage.length;
  const criticalEvents = coverage.filter((c) => c.estado === "Crítico").length;
  const criticalScore =
    totalEvents > 0 ? 100 - (criticalEvents / totalEvents) * 100 : 100;

  const pending = approvals.filter((a) => a.status === "pendiente").length;
  const backlogScore = clampScore(100 - pending * 14);

  const total = referees.length;
  const active = referees.filter((r) => r.estado === "Activo").length;
  const availableScore = total > 0 ? (active / total) * 100 : 100;

  // Campeonatos inminentes (≤21 días) con plazas abiertas penalizan la urgencia.
  const urgentOpen = coverage
    .filter((c) => {
      const d = daysUntil(c.fecha, now);
      return c.open > 0 && d !== null && d >= 0 && d <= 21;
    })
    .reduce((a, c) => a + c.open, 0);
  const urgencyScore = clampScore(100 - urgentOpen * 8);

  const factors: HealthFactor[] = [
    {
      label: "Cobertura de plantillas",
      score: clampScore(coveragePct),
      weight: 0.34,
      detail: `${totalFilled}/${totalReq} plazas asignadas`,
    },
    {
      label: "Estabilidad de campeonatos",
      score: clampScore(criticalScore),
      weight: 0.24,
      detail:
        criticalEvents > 0
          ? `${criticalEvents} de ${totalEvents} en estado crítico`
          : `${totalEvents} campeonatos sin alertas`,
    },
    {
      label: "Urgencia operativa",
      score: urgencyScore,
      weight: 0.18,
      detail:
        urgentOpen > 0
          ? `${urgentOpen} plazas abiertas en campeonatos ≤21 días`
          : "sin urgencias a corto plazo",
    },
    {
      label: "Cola de aprobaciones",
      score: backlogScore,
      weight: 0.12,
      detail:
        pending > 0 ? `${pending} propuestas sin revisar` : "bandeja al día",
    },
    {
      label: "Disponibilidad de jueces",
      score: clampScore(availableScore),
      weight: 0.12,
      detail: `${active}/${total} jueces activos`,
    },
  ];

  const score = clampScore(
    factors.reduce((a, f) => a + f.score * f.weight, 0),
  );
  const status = statusFromScore(score);
  const weakest = [...factors].sort((a, b) => a.score - b.score)[0];

  const summary =
    status === "óptimo"
      ? `Operación óptima — cobertura al ${Math.round(coveragePct)}% y sin focos críticos.`
      : `Operación ${status} — el punto débil es «${weakest?.label.toLowerCase()}» (${weakest?.score}/100).`;

  return { score, status, summary, factors };
}

/** Deriva recomendaciones accionables del estado actual. */
function buildInsights(input: IntelligenceInput, now: Date): Insight[] {
  const { coverage, approvals, promotions, referees } = input;
  const insights: Insight[] = [];

  // 1 — Campeonatos críticos: máxima prioridad.
  for (const c of coverage.filter((e) => e.estado === "Crítico")) {
    const d = daysUntil(c.fecha, now);
    insights.push({
      id: `critical-${c.id}`,
      severity: "crítico",
      title: `${c.nombre} en estado crítico`,
      detail:
        d !== null && d >= 0
          ? `${c.open} plazas sin cubrir y la competición es en ${d} día${d === 1 ? "" : "s"}.`
          : `${c.open} plazas sin cubrir. Asigna jueces cuanto antes.`,
      metric: `${c.open} libres`,
      action: { label: "Completar plantilla", href: `/competitions/${c.id}` },
    });
  }

  // 2 — Campeonatos inminentes con plazas abiertas (aún no críticos).
  for (const c of coverage) {
    if (c.estado === "Crítico" || c.open === 0) continue;
    const d = daysUntil(c.fecha, now);
    if (d === null || d < 0 || d > 21) continue;
    insights.push({
      id: `soon-${c.id}`,
      severity: "alerta",
      title: `${c.nombre} se acerca`,
      detail: `Faltan ${d} día${d === 1 ? "" : "s"} y quedan ${c.open} plaza${c.open === 1 ? "" : "s"} por cubrir.`,
      metric: `${d}d`,
      action: { label: "Revisar roster", href: `/competitions/${c.id}` },
    });
  }

  // 3 — Cola de aprobaciones.
  const pendingApprovals = approvals.filter((a) => a.status === "pendiente").length;
  if (pendingApprovals > 0) {
    insights.push({
      id: "approvals-backlog",
      severity: pendingApprovals >= 4 ? "alerta" : "sugerencia",
      title: `${pendingApprovals} aprobaciones pendientes`,
      detail: "Las propuestas regionales esperan revisión nacional para confirmar plantillas.",
      metric: `${pendingApprovals} en cola`,
      action: { label: "Ir a aprobaciones", href: "/approvals" },
    });
  }

  // 4 — Promociones en espera.
  const pendingPromos = promotions.filter((p) => p.status === "pendiente").length;
  if (pendingPromos > 0) {
    insights.push({
      id: "promotions-pending",
      severity: "sugerencia",
      title: `${pendingPromos} ascensos por resolver`,
      detail: "Resolver ascensos amplía el grupo de jueces elegibles para roles superiores.",
      metric: `${pendingPromos} solicitudes`,
      action: { label: "Ver ascensos", href: "/promotions" },
    });
  }

  // 5 — Disponibilidad de jueces baja.
  const total = referees.length;
  const active = referees.filter((r) => r.estado === "Activo").length;
  const activePct = total > 0 ? (active / total) * 100 : 100;
  if (total > 0 && activePct < 65) {
    insights.push({
      id: "low-availability",
      severity: "alerta",
      title: "Disponibilidad de jueces ajustada",
      detail: `Solo ${active} de ${total} jueces figuran como activos (${Math.round(activePct)}%).`,
      metric: `${Math.round(activePct)}%`,
      action: { label: "Revisar directorio", href: "/referees" },
    });
  }

  // 6 — Sin focos: estado saludable.
  if (!insights.some((i) => i.severity === "crítico" || i.severity === "alerta")) {
    insights.unshift({
      id: "all-clear",
      severity: "ok",
      title: "Operación bajo control",
      detail: "No hay campeonatos críticos ni cuellos de botella. Buen momento para planificar la temporada.",
    });
  }

  return insights
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, 6);
}

/** Punto de entrada: estado operativo → salud + recomendaciones. */
export function buildIntelligence(
  input: IntelligenceInput,
  now = new Date(),
): DashboardIntelligence {
  return {
    health: buildHealth(input, now),
    insights: buildInsights(input, now),
  };
}
