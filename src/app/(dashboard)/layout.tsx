import { AppShell } from "@/components/layout/app-shell";
import { getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const navCounts = await dataService.getNavCounts(user);

  return (
    <AppShell currentUser={user} navCounts={navCounts}>
      {children}
    </AppShell>
  );
}
