import { PageShell } from "@/components/layout/page-shell";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { CoverageForecast } from "@/components/dashboard/coverage-forecast";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardLive } from "@/components/dashboard/dashboard-live";
import { EventsTable } from "@/components/dashboard/events-table";
import { HealthGauge } from "@/components/dashboard/health-gauge";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { SanctionsAlerts } from "@/components/dashboard/sanctions-alerts";
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
      {/* Live status bar */}
      <DashboardLive generatedAt={dashboard.generatedAt} />

      {/* Hero */}
      <DashboardHero user={dashboard.currentUser} dashboard={dashboard} />

      {/* KPIs */}
      <KpiCards kpis={dashboard.kpis} />

      <SanctionsAlerts alerts={dashboard.sanctionAlerts} />

      {/* Health + Insights side-by-side on large screens */}
      <div className="grid gap-4 lg:grid-cols-2">
        <HealthGauge health={dashboard.health} />
        <InsightsPanel insights={dashboard.insights} />
      </div>

      {/* Calendar (wider) + Coverage forecast */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OperationalCalendar calendar={dashboard.calendar} />
        </div>
        <CoverageForecast coverage={dashboard.coverage} />
      </div>

      {/* Events table (wider) + Activity feed */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EventsTable competitions={dashboard.upcomingCompetitions} />
        </div>
        <ActivityFeed activity={dashboard.activity} />
      </div>
    </PageShell>
  );
}
