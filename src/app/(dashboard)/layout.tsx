import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const navCounts = await dataService.getNavCounts(user);

  return (
    <AppShell currentUser={user} navCounts={navCounts}>
      {children}
    </AppShell>
  );
}
