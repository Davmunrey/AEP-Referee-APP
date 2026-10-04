import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { ExamsManager } from "@/components/judge/exams-manager";
import { MetricStrip, MetricTile, type MetricTone } from "@/components/ui/metric-tile";
import { canAdminJudges, canManageJudges, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { AEP_JUDGE_LICENSE_NOTE } from "@/lib/aep-guide-2026";

export default async function ExamsPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const [exams, referees] = await Promise.all([
    dataService.getExams(undefined, user),
    dataService.getReferees({ user }),
  ]);

  const aprobados = exams.filter((e) => e.resultado === "Aprobado").length;
  const pendientes = exams.filter((e) => e.resultado === "Pendiente").length;
  const suspensos = exams.filter((e) => e.resultado === "Suspenso").length;
  const resueltos = aprobados + suspensos;
  // Sin exámenes resueltos no hay tasa: un «0 %» se lee como «suspende todo el
  // mundo», que es justo lo contrario de «aún no hay datos».
  const tasa = resueltos > 0 ? Math.round((aprobados / resueltos) * 100) : null;

  // El color solo marca lo que pide hacer algo: los exámenes pendientes.
  const stats: { label: string; value: string | number; tone: MetricTone }[] = [
    { label: "Exámenes totales", value: exams.length, tone: "neutral" },
    { label: "Aprobados", value: aprobados, tone: "neutral" },
    { label: "Pendientes", value: pendientes, tone: pendientes > 0 ? "warning" : "neutral" },
    { label: "Tasa de aprobación", value: tasa === null ? "—" : `${tasa}%`, tone: "neutral" },
  ];

  return (
    <PageShell>
      <div>
        <PageHeader
          title="Exámenes de jueces"
          description="Altas de nuevos jueces, ascensos a categoría IPF y recertificaciones"
        />
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          {AEP_JUDGE_LICENSE_NOTE}
        </p>
      </div>
      <MetricStrip columns={4}>
        {stats.map((st) => (
          <MetricTile key={st.label} label={st.label} value={st.value} tone={st.tone} />
        ))}
      </MetricStrip>
      <ExamsManager
        exams={exams}
        referees={referees.map((r) => ({ id: r.id, nombre: r.nombre, nivel: r.nivel }))}
        // Los mismos permisos que exige la API: con `role !== "solo_ver"` se
        // pintaban botones de alta y edición a roles nacionales que luego
        // recibían un 403 al pulsarlos.
        canEdit={canManageJudges(user)}
        canDelete={canAdminJudges(user)}
      />
    </PageShell>
  );
}
