import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { dataService } from "@/server/services";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const [analytics, competitions] = await Promise.all([
    dataService.getAnalytics(user),
    dataService.getCompetitions(user),
  ]);
  const competitionsInSelectedYear = competitions.filter((c) =>
    c.fecha.startsWith(String(analytics.selectedYear)),
  );

  // Neutraliza inyección de fórmulas (CSV injection): si un valor empieza por
  // = + - @ (o tab/CR), antepone una comilla simple para que Excel/Sheets no lo
  // evalúe como fórmula. Además escapa las comillas dobles.
  const csv = (...values: Array<string | number>) =>
    values
      .map((v) => {
        let s = String(v);
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        return `"${s.replace(/"/g, '""')}"`;
      })
      .join(",");

  const lines: string[] = [
    "AEP Tarima — Estadísticas",
    `Exportado: ${new Date().toISOString()}`,
    `Año activo: ${analytics.selectedYear}`,
    "",
    "RESUMEN_AÑO",
    "Año,Campeonatos,Campeonatos críticos,Plazas cubiertas,Plazas abiertas,Jueces asignados,Aprobaciones pendientes,Tasa rechazo",
    csv(
      analytics.selectedYear,
      analytics.totals.competitions,
      analytics.totals.criticalCompetitions,
      analytics.totals.filledSlots,
      analytics.totals.openSlots,
      analytics.totals.uniqueAssignedReferees,
      analytics.totals.pendingApprovals,
      `${analytics.rejectionRate}%`,
    ),
    "",
    "HISTORICO_POR_AÑO",
    "Año,Campeonatos,Campeonatos críticos,Plazas totales,Plazas cubiertas,Cobertura,Jueces asignados",
    ...analytics.yearlyHistory.map((row) =>
      csv(
        row.year,
        row.competitions,
        row.criticalCompetitions,
        row.requiredSlots,
        row.filledSlots,
        `${row.requiredSlots > 0 ? Math.round((row.filledSlots / row.requiredSlots) * 100) : 0}%`,
        row.uniqueAssignedReferees,
      ),
    ),
    "",
    "ACTIVIDAD_POR_ZONA_AÑO_ACTIVO",
    "Zona,Código,Campeonatos,Campeonatos críticos,Plazas totales,Plazas cubiertas,Cobertura,Jueces asignados,Jueces activos",
    ...analytics.activityByZone.map((row) =>
      csv(
        row.name,
        row.zona,
        row.competitions,
        row.criticalCompetitions,
        row.requiredSlots,
        row.filledSlots,
        `${row.requiredSlots > 0 ? Math.round((row.filledSlots / row.requiredSlots) * 100) : 0}%`,
        row.uniqueAssignedReferees,
        row.activeReferees,
      ),
    ),
    "",
    "JUECES_MAS_ASIGNADOS_AÑO_ACTIVO",
    "Nombre,Nivel,Campeonatos asignados,Plazas asignadas",
    ...analytics.topReferees.map((row) =>
      csv(row.nombre, row.nivel, row.assignedCompetitions, row.assignedSlots),
    ),
    "",
    "CAMPEONATOS_AÑO_ACTIVO",
    "Nombre,Tipo,Zona,Fecha,Estado,Plazas cubiertas,Plazas totales,Cobertura",
    ...competitionsInSelectedYear.map((c) =>
      csv(
        c.nombre,
        c.tipo,
        c.zona ?? "",
        c.fecha,
        c.estado,
        c.confirmados,
        c.requeridos,
        `${c.requeridos > 0 ? Math.round((c.confirmados / c.requeridos) * 100) : 0}%`,
      ),
    ),
    "",
    "CAMPEONATOS_CRITICOS_AÑO_ACTIVO",
    "Nombre,Tipo,Zona,Fecha,Estado",
    ...analytics.criticalEvents.map((c) =>
      csv(c.nombre, c.tipo, c.zona ?? "", c.fecha, c.estado),
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aep-temporada-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
