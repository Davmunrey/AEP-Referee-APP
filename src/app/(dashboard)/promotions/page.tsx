import { PromotionsBoard } from "@/components/promotions/promotions-board";
import { canReviewPromotions, getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function PromotionsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const [promotions, meta, referees] = await Promise.all([
    dataService.getPromotions(user),
    dataService.getMeta(user),
    dataService.getReferees({ user }),
  ]);

  return (
    <PromotionsBoard
      initial={promotions}
      canReview={canReviewPromotions(user)}
      canCreate={user.role !== "solo_ver"}
      referees={referees}
      zones={meta.zones}
      userZona={user.zona}
    />
  );
}
