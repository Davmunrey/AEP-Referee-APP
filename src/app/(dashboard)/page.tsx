import { PageShell } from "@/components/layout/page-shell";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardLive } from "@/components/dashboard/dashboard-live";
import { EventsTable } from "@/components/dashboard/events-table";
import { HealthGauge } from "@/components/dashboard/health-gauge";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { OperationalCalendar } from "@/components/dashboard/operational-calendar";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const dashboard = await dataService.getDashboard(user);

  return (
    <PageShell>
      <DashboardLive generatedAt={dashboard.generatedAt} />
      <DashboardHero user={dashboard.currentUser} dashboard={dashboard} />
      <KpiCards kpis={dashboard.kpis} />
      <div className="grid gap-4 xl:grid-cols-2">
        <HealthGauge health={dashboard.health} />
        <InsightsPanel insights={dashboard.insights} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <OperationalCalendar calendar={dashboard.calendar} />
        </div>
        <ActivityFeed activity={dashboard.activity} />
      </div>
      <EventsTable competitions={dashboard.upcomingCompetitions} />
    </PageShell>
  );
}
