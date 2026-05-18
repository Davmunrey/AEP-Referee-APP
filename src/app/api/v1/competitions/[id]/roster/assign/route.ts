import { isCompetitionPast } from "@/lib/competition-status";
import { canEditRoster } from "@/lib/auth/session";
import { assignRefereeSchema } from "@/lib/validations";
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
  if (isCompetitionPast(comp)) return jsonError("Campeonato finalizado: solo lectura", 423);

  const body = await request.json();
  const parsed = assignRefereeSchema.safeParse({
    competitionId,
    slotKey: body.slotKey,
    refereeId: body.refereeId,
    flags: body.flags,
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
  );
  if (result.error) return jsonError(result.error, 400);
  return jsonOk({
    assignments: result.assignments,
    flags: result.flags,
  });
}
