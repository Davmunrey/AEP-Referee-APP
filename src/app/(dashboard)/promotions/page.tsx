import { PromotionsBoard } from "@/components/promotions/promotions-board";
import { canManageJudges, canReviewPromotions, getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function PromotionsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const [promotions, referees] = await Promise.all([
    dataService.getPromotions(user),
    dataService.getReferees({ user }),
  ]);

  return (
    <PromotionsBoard
      initial={promotions}
      canReview={canReviewPromotions(user)}
      // La API exige `canManageJudges` para crear la solicitud: con
      // `role !== "solo_ver"` el botón salía a roles que recibían un 403.
      canCreate={canManageJudges(user)}
      referees={referees}
    />
  );
}
