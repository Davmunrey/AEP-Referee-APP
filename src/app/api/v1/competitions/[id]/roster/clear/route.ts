import { canEditRoster } from "@/lib/auth/session";
import { clearSlotSchema } from "@/lib/validations";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await dataService.getCompetition(competitionId);
  if (!comp) return jsonError("Competición no encontrada", 404);
  if (!canEditRoster(user, comp.zona)) return jsonError("Sin permiso en esta zona", 403);

  const body = await request.json();
  const parsed = clearSlotSchema.safeParse({ competitionId, slotKey: body.slotKey });
  if (!parsed.success) {
    return jsonError("Datos de slot inválidos", 400, parsed.error.flatten());
  }

  const assignments = await dataService.clearSlot(
    parsed.data.competitionId,
    parsed.data.slotKey,
    user.nombre,
  );
  return jsonOk({ assignments });
}
