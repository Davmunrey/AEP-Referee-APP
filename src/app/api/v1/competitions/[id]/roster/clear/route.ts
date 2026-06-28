import { clearSlotSchema } from "@/lib/validations";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { guardRosterWrite } from "@/lib/api/roster-mutation-guard";
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
  const blocked = guardRosterWrite(comp, user);
  if (blocked) return blocked;
  if (!comp) return jsonError("Competición no encontrada", 404);

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

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await dataService.getCompetition(competitionId);
  const blocked = guardRosterWrite(comp, user);
  if (blocked) return blocked;
  if (!comp) return jsonError("Competición no encontrada", 404);

  const result = await dataService.clearRosterAssignments(competitionId, user.nombre);
  if (!result) return jsonError("No se pudieron borrar las asignaciones", 400);
  return jsonOk(result);
}
