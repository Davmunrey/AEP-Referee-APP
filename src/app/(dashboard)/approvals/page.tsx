import { ApprovalsBoard } from "@/components/approvals/approvals-board";
import { canApprove, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export default async function ApprovalsPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const [approvals, referees, competitions] = await Promise.all([
    dataService.getApprovals(user),
    dataService.getReferees({ user }),
    dataService.getCompetitions(user),
  ]);
  const refNames = Object.fromEntries(referees.map((r) => [r.id, r.nombre]));
  return (
    <ApprovalsBoard
      initial={approvals}
      canReview={canApprove(user)}
      refNames={refNames}
      competitions={competitions}
    />
  );
}
