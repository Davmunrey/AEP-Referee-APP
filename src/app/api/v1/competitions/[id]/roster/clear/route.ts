import { RosterSlotConflictError } from "@/lib/competitions/service-types";
import { clearSlotSchema } from "@/lib/validations";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { guardRosterWrite } from "@/lib/api/roster-mutation-guard";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  const parsed = clearSlotSchema.safeParse({
    competitionId,
    slotKey: body.slotKey,
    expectedRefereeId: "expectedRefereeId" in body ? body.expectedRefereeId : undefined,
  });
  if (!parsed.success) {
    return jsonError("Datos de slot inválidos", 400, parsed.error.flatten());
  }

  try {
    const assignments = await dataService.clearSlot(
      parsed.data.competitionId,
      parsed.data.slotKey,
      user.nombre,
      parsed.data.expectedRefereeId,
    );
    return jsonOk({ assignments });
  } catch (err) {
    if (err instanceof RosterSlotConflictError) return jsonError(err.message, 409);
    return jsonServerError("roster/clear", err, "No se pudo liberar el hueco");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await dataService.getCompetition(competitionId);
  const blocked = guardRosterWrite(comp, user);
  if (blocked) return blocked;
  if (!comp) return jsonError("Competición no encontrada", 404);

  try {
    const result = await dataService.clearRosterAssignments(competitionId, user.nombre);
    if (!result) return jsonError("No se pudieron borrar las asignaciones", 400);
    return jsonOk(result);
  } catch (err) {
    return jsonServerError("roster/clear-all", err, "No se pudieron borrar las asignaciones");
  }
}
