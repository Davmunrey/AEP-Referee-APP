import { canEditRoster } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; refereeId: string }> },
) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { id, refereeId } = await params;

  // Delegados de zona solo pueden gestionar disponibilidad en su propia zona
  const comp = await dataService.getCompetition(id);
  if (!comp) return jsonError("Competición no encontrada", 404);
  if (!canEditRoster(user, comp.zona)) return jsonError("Sin permiso en esta zona", 403);

  try {
    await dataService.removeCompetitionAvailability(id, refereeId);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonServerError("availability.DELETE", err, "No se pudo eliminar la disponibilidad");
  }
}
