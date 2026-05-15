import { RefereesDirectory } from "@/components/referees/referees-directory";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { getLevels, getZones } from "@/server/store";
import { redirect } from "next/navigation";

export default async function RefereesPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const referees = dataService.getReferees({ user });
  const zones = getZones();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operaciones"
        title="Directorio de árbitros"
        description={`${referees.length} árbitros · ${zones.length} zonas federativas`}
      />
      <RefereesDirectory
        initialReferees={referees}
        zones={zones}
        levels={getLevels()}
        canEdit={user.role !== "lectura"}
      />
    </PageShell>
  );
}
