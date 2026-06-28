import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { guardRosterWrite } from "@/lib/api/roster-mutation-guard";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { getPresetForEventType } from "@/lib/roster-template";
import type { RosterSession } from "@/lib/types";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Genera y guarda la plantilla AEP estándar para el tipo de la competición
 * (preset de cuadrante real). Permite configurar la tarima desde clientes que no
 * incluyen el editor completo (p. ej. la app móvil). Idempotente: reaplica el
 * preset del tipo.
 */
export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await dataService.getCompetition(competitionId);
  const blocked = guardRosterWrite(comp, user);
  if (blocked) return blocked;
  if (!comp) return jsonError("Competición no encontrada", 404);

  const preset = getPresetForEventType(comp.tipo);
  const result = await dataService.saveCompetitionTemplate(competitionId, preset, user.nombre);
  if (!result) return jsonError("No se pudo generar la plantilla", 400);
  return jsonOk(result);
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await dataService.getCompetition(competitionId);
  const blocked = guardRosterWrite(comp, user);
  if (blocked) return blocked;
  if (!comp) return jsonError("Competición no encontrada", 404);

  const body = await request.json().catch(() => null);
  const template = body?.template as RosterSession[] | undefined;
  if (!Array.isArray(template) || template.length === 0) {
    return jsonError("Plantilla inválida", 400);
  }

  const result = await dataService.saveCompetitionTemplate(
    competitionId,
    template,
    user.nombre,
  );
  if (!result) return jsonError("No se pudo guardar la plantilla", 400);
  return jsonOk(result);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await dataService.getCompetition(competitionId);
  const blocked = guardRosterWrite(comp, user);
  if (blocked) return blocked;
  if (!comp) return jsonError("Competición no encontrada", 404);

  const result = await dataService.saveCompetitionTemplate(competitionId, [], user.nombre);
  if (!result) return jsonError("No se pudo borrar la plantilla", 400);
  return jsonOk(result);
}
