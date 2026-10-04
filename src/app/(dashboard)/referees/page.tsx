import { RefereesDirectory } from "@/components/referees/referees-directory";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { canImportJudgesRegistry } from "@/lib/permissions";
import { canManageJudges, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { stripRefereeListPII } from "@/lib/referee-pii";
import { dataService } from "@/server/services";
import { contar } from "@/lib/plural";
import { getJudgeAccessStatuses } from "@/server/services/judge-accounts";

export default async function RefereesPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const meta = await dataService.getMeta(user);
  // El recorte de PII lo hacía solo la ruta API, y la página es justo la que
  // entrega el censo al navegador: `solo_ver` recibía email, teléfono,
  // domicilio, coordenadas y notas de cada juez en la carga inicial.
  const referees = stripRefereeListPII(await dataService.getReferees({ user }), user);
  const zones = meta.zones;
  // Quién tiene ya cuenta en el portal: solo para quien puede invitar.
  const portalStatuses = canManageJudges(user) ? await getJudgeAccessStatuses(referees) : undefined;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Jueces"
        title="Directorio de jueces"
        description={`${contar(referees.length, "juez", "jueces")} · ${zones.length} zonas federativas`}
      />
      <RefereesDirectory
        initialReferees={referees}
        zones={zones}
        levels={meta.levels}
        canEdit={canManageJudges(user)}
        canImport={canImportJudgesRegistry(user.role)}
        portalStatuses={portalStatuses}
      />
    </PageShell>
  );
}
