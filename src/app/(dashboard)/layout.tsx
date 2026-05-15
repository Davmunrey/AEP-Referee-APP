import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DEMO_PERSONAS, isDemoMode, personaForSession } from "@/lib/auth/demo";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const meta = dataService.getMeta(user);
  const navCounts = dataService.getNavCounts(user);

  return (
    <AppShell
      currentUser={meta.currentUser}
      navCounts={navCounts}
      demoEnabled={isDemoMode()}
      personas={DEMO_PERSONAS}
      currentPersona={personaForSession(user)}
    >
      {children}
    </AppShell>
  );
}
