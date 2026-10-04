import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const { year } = await searchParams;
  const parsed = year ? Number(year) : NaN;
  const requestedYear = Number.isInteger(parsed) ? parsed : undefined;

  return (
    <AnalyticsDashboard data={await dataService.getAnalytics(user, requestedYear)} />
  );
}
