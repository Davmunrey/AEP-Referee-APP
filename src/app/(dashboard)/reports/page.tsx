import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { ReportsManager } from "@/components/judge/reports-manager";
import { MetricTile, type MetricTone } from "@/components/ui/metric-tile";
import { canAdminJudges, canManageJudges, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { AlertTriangle, FileText, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default async function ReportsPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const [reports, referees, competitions] = await Promise.all([
    dataService.getReports(undefined, user),
    dataService.getReferees({ user }),
    dataService.getCompetitionOptions(user),
  ]);

  const incidencias = reports.filter((r) => r.tipo === "Incidencia").length;
  const evaluaciones = reports.filter((r) => r.tipo === "Evaluación").length;
  const jueces = new Set(reports.map((r) => r.refereeId).filter(Boolean)).size;
  const competiciones = reports.filter((r) => r.subjectType === "competicion").length;

  const stats: { label: string; value: number; tone: MetricTone; icon: LucideIcon }[] = [
    { label: "Informes totales", value: reports.length, tone: "neutral", icon: FileText },
    { label: "Incidencias", value: incidencias, tone: "danger", icon: AlertTriangle },
    { label: "Evaluaciones", value: evaluaciones, tone: "warning", icon: Star },
    { label: "Jueces con informe", value: jueces, tone: "primary", icon: Users },
    { label: "Informes de competición", value: competiciones, tone: "neutral", icon: FileText },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Jueces"
        title="Informes de zona"
        description="Informes de jueces y competiciones. Delegado de zona ve su zona; nacional y superadmin ven todo."
      />
      {/* La misma pieza de cifras que Aprobaciones, Ascensos y Exámenes. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <MetricTile key={s.label} label={s.label} value={s.value} tone={s.tone} icon={s.icon} />
        ))}
      </div>
      <ReportsManager
        reports={reports}
        referees={referees.map((r) => ({ id: r.id, nombre: r.nombre }))}
        competitions={competitions}
        // Los mismos permisos que exige la API: con `role !== "solo_ver"` se
        // pintaban botones de alta y edición a roles nacionales que luego
        // recibían un 403 al pulsarlos.
        canEdit={canManageJudges(user)}
        canDelete={canAdminJudges(user)}
      />
    </PageShell>
  );
}
