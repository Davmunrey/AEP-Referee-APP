import { ApprovalsBoard } from "@/components/approvals/approvals-board";
import { canApprove, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export default async function ApprovalsPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  // De los campeonatos la bandeja solo pinta el estado del de la propuesta
  // elegida. Antes se cargaba `getCompetitions` entero (todas las temporadas,
  // plantillas y asignaciones) y se mandaba al navegador, en cada visita y tras
  // cada aprobación (router.refresh). Ahora se pide solo el estado de los
  // campeonatos que citan las propuestas, encadenado a ellas y en paralelo con
  // el censo.
  const conEstados = dataService.getApprovals(user).then(async (approvals) => ({
    approvals,
    estadoById: await dataService.getCompetitionEstados(
      approvals.map((a) => a.competitionId),
      user,
    ),
  }));
  const [{ approvals, estadoById }, referees] = await Promise.all([
    conEstados,
    dataService.getReferees({ user }),
  ]);
  const refNames = Object.fromEntries(referees.map((r) => [r.id, r.nombre]));
  return (
    <ApprovalsBoard
      initial={approvals}
      canReview={canApprove(user)}
      refNames={refNames}
      estadoById={estadoById}
    />
  );
}
