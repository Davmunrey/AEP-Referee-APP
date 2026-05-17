import { RefereesDirectory } from "@/components/referees/referees-directory";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function RefereesPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const meta = await dataService.getMeta(user);
  const referees = await dataService.getReferees({ user });
  const zones = meta.zones;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operaciones"
        title="Directorio de jueces"
        description={`${referees.length} jueces · ${zones.length} zonas federativas`}
      />
      <RefereesDirectory
        initialReferees={referees}
        zones={zones}
        levels={meta.levels}
        canEdit={user.role !== "solo_ver"}
      />
    </PageShell>
  );
}
