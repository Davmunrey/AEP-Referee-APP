import { PageShell } from "@/components/layout/page-shell";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { OperationalCalendar } from "@/components/dashboard/operational-calendar";
import { PendingPanel } from "@/components/dashboard/pending-panel";
import { UpcomingCompetitions } from "@/components/dashboard/upcoming-competitions";
import { getSession } from "@/lib/auth/session";
import { SIGN_IN_SIN_ACCESO } from "@/lib/auth/sign-in-redirect";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect(SIGN_IN_SIN_ACCESO);

  const dashboard = await dataService.getDashboard(user);

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
        <PendingPanel insights={dashboard.insights} sanctions={dashboard.sanctionAlerts} />
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
