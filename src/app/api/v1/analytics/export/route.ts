import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { dataService } from "@/server/services";

export async function GET() {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const [competitions, referees] = await Promise.all([
    dataService.getCompetitions(user),
    dataService.getReferees({ user }),
  ]);

  const lines: string[] = [
    "AEP Tarima — Resumen de temporada",
    `Exportado: ${new Date().toISOString()}`,
    "",
    "CAMPEONATOS",
    "Nombre,Tipo,Zona,Fecha,Estado,Confirmados,Requeridos,Cobertura%",
    ...competitions.map((c) => {
      const pct = c.requeridos > 0 ? Math.round((c.confirmados / c.requeridos) * 100) : 0;
      return [c.nombre, c.tipo, c.zona ?? "", c.fecha, c.estado, c.confirmados, c.requeridos, `${pct}%`]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    }),
    "",
    "ÁRBITROS",
    "Nombre,Zona,Nivel,Estado,Eventos 2026",
    ...referees.map((r) =>
      [r.nombre, r.zona, r.nivel, r.estado, r.eventos]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aep-temporada-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
