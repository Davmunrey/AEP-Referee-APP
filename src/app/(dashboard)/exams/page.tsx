import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { ExamsManager } from "@/components/judge/exams-manager";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function ExamsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const [exams, referees] = await Promise.all([
    dataService.getExams(),
    dataService.getReferees({ user }),
  ]);

  const aprobados = exams.filter((e) => e.resultado === "Aprobado").length;
  const pendientes = exams.filter((e) => e.resultado === "Pendiente").length;
  const suspensos = exams.filter((e) => e.resultado === "Suspenso").length;
  const resueltos = aprobados + suspensos;
  const tasa = resueltos > 0 ? Math.round((aprobados / resueltos) * 100) : 0;

  const stats = [
    { label: "Exámenes totales", value: exams.length, tone: "text-foreground" },
    { label: "Aprobados", value: aprobados, tone: "text-success" },
    { label: "Pendientes", value: pendientes, tone: "text-warning" },
    { label: "Tasa de aprobación", value: `${tasa}%`, tone: "text-primary" },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestión de jueces"
        title="Exámenes arbitrales"
        description="Teoría, práctica, reglamento IPF y recertificaciones de la plantilla arbitral"
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
      <ExamsManager
        exams={exams}
        referees={referees.map((r) => ({ id: r.id, nombre: r.nombre }))}
        canEdit={user.role !== "solo_ver"}
        canDelete={user.role === "super_admin" || user.role === "delegado_jueces"}
      />
    </PageShell>
  );
}
