import { assignRefereeSchema } from "@/lib/validations";
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Cuerpo de solicitud inválido", 400);
  }
  const parsed = assignRefereeSchema.safeParse({
    competitionId,
    slotKey: body.slotKey,
    refereeId: body.refereeId,
    flags: body.flags,
    crossZoneReason: body.crossZoneReason,
  });
  if (!parsed.success) {
    return jsonError("Datos de asignación inválidos", 400, parsed.error.flatten());
  }

  const result = await dataService.assignReferee(
    parsed.data.competitionId,
    parsed.data.slotKey,
    parsed.data.refereeId,
    user.nombre,
    parsed.data.flags,
    parsed.data.crossZoneReason,
  );
  if (result.error) return jsonError(result.error, 400);
  return jsonOk({
    assignments: result.assignments,
    flags: result.flags,
    crossZoneMap: result.crossZoneMap,
  });
}
