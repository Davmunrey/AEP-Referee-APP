import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const { year } = await searchParams;
  const parsed = year ? Number(year) : NaN;
  const requestedYear = Number.isInteger(parsed) ? parsed : undefined;

  return (
    <AnalyticsDashboard data={await dataService.getAnalytics(user, requestedYear)} />
  );
}
