import { PageShell } from "@/components/layout/page-shell";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { CoverageForecast } from "@/components/dashboard/coverage-forecast";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardLive } from "@/components/dashboard/dashboard-live";
import { CompetitionsTable } from "@/components/dashboard/competitions-table";
import { HealthGauge } from "@/components/dashboard/health-gauge";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { SanctionsAlerts } from "@/components/dashboard/sanctions-alerts";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { OperationalCalendar } from "@/components/dashboard/operational-calendar";
import { PriorityRadar } from "@/components/dashboard/priority-radar";
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
      <div className="grid gap-4 2xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
        <HealthGauge health={dashboard.health} />
        <InsightsPanel insights={dashboard.insights} />
      </div>

      {/* Priority radar + Coverage forecast */}
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <PriorityRadar coverage={dashboard.coverage} />
        <CoverageForecast coverage={dashboard.coverage} />
      </div>

      {/* Calendar */}
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <div>
          <OperationalCalendar calendar={dashboard.calendar} />
        </div>
        <ActivityFeed activity={dashboard.activity} />
      </div>

      {/* Events table */}
      <CompetitionsTable competitions={dashboard.upcomingCompetitions} />
    </PageShell>
  );
}
