import { PageShell } from "@/components/layout/page-shell";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { OperationalCalendar } from "@/components/dashboard/operational-calendar";
import { PendingPanel } from "@/components/dashboard/pending-panel";
import { UpcomingCompetitions } from "@/components/dashboard/upcoming-competitions";
import { getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { solicitudesParaUsuario } from "@/server/convocatorias";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const [dashboard, solicitudes] = await Promise.all([
    dataService.getDashboard(user),
    // Las peticiones de otras zonas no pueden tumbar la portada.
    solicitudesParaUsuario(user).catch((err) => {
      console.error("[dashboard.solicitudes]", err);
      return [];
    }),
  ]);

  // Cada dato aparece una vez. Antes el mismo campeonato salía en el saludo,
  // en «Recomendaciones», en «Radar operativo», en «Previsión de cobertura» y
  // en la tabla del pie, con dos coberturas distintas.
  return (
    <PageShell>
      <DashboardHeader dashboard={dashboard} />

      <KpiCards kpis={dashboard.kpis} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="min-w-0 [&>*]:h-full">
          <UpcomingCompetitions competitions={dashboard.upcomingCompetitions} />
        </div>
        <PendingPanel insights={dashboard.insights} sanctions={dashboard.sanctionAlerts} solicitudes={solicitudes} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="min-w-0 [&>*]:h-full">
          <OperationalCalendar calendar={dashboard.calendar} />
        </div>
        <ActivityFeed activity={dashboard.activity} />
      </div>
    </PageShell>
  );
}
