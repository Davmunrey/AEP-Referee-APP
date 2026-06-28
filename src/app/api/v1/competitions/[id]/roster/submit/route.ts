import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { guardRosterWrite } from "@/lib/api/roster-mutation-guard";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { computeRosterCoverage } from "@/lib/roster-coverage";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id } = await context.params;
  const comp = await dataService.getCompetition(id);
  const blocked = guardRosterWrite(comp, user);
  if (blocked) return blocked;
  if (!comp) return jsonError("Competición no encontrada", 404);
  const roster = await dataService.getRoster(id);
  if (!roster || roster.template.length === 0) {
    return jsonError("Define una plantilla antes de enviar a aprobación", 400);
  }
  const coverage = computeRosterCoverage(roster.template, roster.assignments, comp.requeridos);
  if (coverage.confirmados === 0) {
    return jsonError("No puedes enviar una tarima sin jueces asignados", 400);
  }
  if (coverage.openSlots > 0) {
    return jsonError(`Completa todos los huecos antes de enviar (${coverage.openSlots} pendientes)`, 400);
  }

  const proposal = await dataService.submitRoster(id, user.nombre, user.id);
  if (!proposal) return jsonError("No se pudo enviar", 400);
  return jsonOk({
    message: "Propuesta enviada a aprobación nacional",
    proposal,
  });
}
