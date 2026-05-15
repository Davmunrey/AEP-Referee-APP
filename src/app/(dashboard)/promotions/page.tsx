import { PromotionsBoard } from "@/components/promotions/promotions-board";
import { canApprove, getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function PromotionsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <PromotionsBoard
      initial={dataService.getPromotions(user)}
      canReview={canApprove(user)}
    />
  );
}
