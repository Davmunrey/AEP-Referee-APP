import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { orgLabelForUser } from "@/lib/auth/profile";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const navCounts = await dataService.getNavCounts(user);
  const { org, subtitle } = orgLabelForUser(user);

  return (
    <AppShell
      currentUser={user}
      navCounts={navCounts}
      orgLabel={org}
      orgSubtitle={subtitle}
    >
      {children}
    </AppShell>
  );
}
