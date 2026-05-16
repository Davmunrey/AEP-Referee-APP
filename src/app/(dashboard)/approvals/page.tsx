import { ApprovalsBoard } from "@/components/approvals/approvals-board";
import { canApprove, getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function ApprovalsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const [approvals, referees] = await Promise.all([
    dataService.getApprovals(user),
    dataService.getReferees({ user }),
  ]);
  const refNames = Object.fromEntries(referees.map((r) => [r.id, r.nombre]));
  return <ApprovalsBoard initial={approvals} canReview={canApprove(user)} refNames={refNames} />;
}
