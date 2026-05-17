import { isCompetitionPast } from "@/lib/competition-status";
import { canEditRoster } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import type { RosterSession } from "@/lib/types";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: eventId } = await context.params;
  const comp = await dataService.getCompetition(eventId);
  if (!comp) return jsonError("Competición no encontrada", 404);
  if (!canEditRoster(user, comp.zona)) return jsonError("Sin permiso en esta zona", 403);
  if (isCompetitionPast(comp)) return jsonError("Campeonato finalizado: solo lectura", 423);

  const body = await request.json().catch(() => null);
  const template = body?.template as RosterSession[] | undefined;
  if (!Array.isArray(template) || template.length === 0) {
    return jsonError("Plantilla inválida", 400);
  }

  const result = await dataService.saveCompetitionTemplate(
    eventId,
    template,
    user.nombre,
  );
  if (!result) return jsonError("No se pudo guardar la plantilla", 400);
  return jsonOk(result);
}
