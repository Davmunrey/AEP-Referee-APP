import { PromotionsBoard } from "@/components/promotions/promotions-board";
import { canManageJudges, canReviewPromotions, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export default async function PromotionsPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const canCreate = canManageJudges(user);
  // El censo solo alimenta el diálogo de nueva solicitud, que solo se monta
  // con `canCreate`: a quien no puede crear no se le manda nada. Y a quien
  // puede, solo id, nombre, nivel y estado —lo que usa el selector—, no la
  // ficha entera con sus estadísticas por año, que era casi todo el peso de
  // la página y además PII que el navegador no necesitaba.
  const [promotions, referees] = await Promise.all([
    dataService.getPromotions(user),
    canCreate ? dataService.getRefereeOptions({ user }) : Promise.resolve([]),
  ]);

  return (
    <PromotionsBoard
      initial={promotions}
      canReview={canReviewPromotions(user)}
      // La API exige `canManageJudges` para crear la solicitud: con
      // `role !== "solo_ver"` el botón salía a roles que recibían un 403.
      canCreate={canCreate}
      referees={referees}
    />
  );
}
