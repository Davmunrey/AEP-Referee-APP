import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  return <AnalyticsDashboard data={await dataService.getAnalytics(user)} />;
}
