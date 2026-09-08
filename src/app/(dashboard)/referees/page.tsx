import { RefereesDirectory } from "@/components/referees/referees-directory";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { canImportJudgesRegistry } from "@/lib/permissions";
import { canManageJudges, getSession } from "@/lib/auth/session";
import { stripRefereeListPII } from "@/lib/referee-pii";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function RefereesPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const meta = await dataService.getMeta(user);
  // El recorte de PII lo hacía solo la ruta API, y la página es justo la que
  // entrega el censo al navegador: `solo_ver` recibía email, teléfono,
  // domicilio, coordenadas y notas de cada juez en la carga inicial.
  const referees = stripRefereeListPII(await dataService.getReferees({ user }), user);
  const zones = meta.zones;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestión de jueces"
        title="Directorio de jueces"
        description={`${referees.length} jueces · ${zones.length} zonas federativas`}
      />
      <RefereesDirectory
        initialReferees={referees}
        zones={zones}
        levels={meta.levels}
        canEdit={canManageJudges(user)}
        canImport={canImportJudgesRegistry(user.role)}
      />
    </PageShell>
  );
}
