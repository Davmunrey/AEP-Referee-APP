import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { ReportsManager } from "@/components/judge/reports-manager";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function ReportsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const [reports, referees] = await Promise.all([
    dataService.getReports(),
    dataService.getReferees({ user }),
  ]);

  const incidencias = reports.filter((r) => r.tipo === "Incidencia").length;
  const evaluaciones = reports.filter((r) => r.tipo === "Evaluación").length;
  const jueces = new Set(reports.map((r) => r.refereeId)).size;

  const stats = [
    { label: "Informes totales", value: reports.length, tone: "text-foreground" },
    { label: "Incidencias", value: incidencias, tone: "text-destructive" },
    { label: "Evaluaciones", value: evaluaciones, tone: "text-warning" },
    { label: "Jueces con informe", value: jueces, tone: "text-primary" },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestión de jueces"
        title="Sandbox de informes"
        description="Repositorio de informes de desempeño, incidencias y evaluaciones por juez"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <p className="friendly-label mb-1">{s.label}</p>
              <p className={`text-2xl font-bold tracking-tight ${s.tone}`}>
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <ReportsManager
        reports={reports}
        referees={referees.map((r) => ({ id: r.id, nombre: r.nombre }))}
        canEdit={user.role !== "lectura"}
        canDelete={user.role === "nacional"}
      />
    </PageShell>
  );
}
