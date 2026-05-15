import { ApprovalsBoard } from "@/components/approvals/approvals-board";
import { canApprove, getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function ApprovalsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const approvals = dataService.getApprovals(user);
  return <ApprovalsBoard initial={approvals} canReview={canApprove(user)} />;
}
