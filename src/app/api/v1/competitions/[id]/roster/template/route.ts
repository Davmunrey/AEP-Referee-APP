import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { guardRosterWrite } from "@/lib/api/roster-mutation-guard";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { getPresetForEventType } from "@/lib/roster-template";
import { rosterTemplateSchema } from "@/lib/validations";
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
  if (!result) return jsonError("No se pudo generar la plantilla", 500);
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
  // Validación estructural completa: `slots` entero acotado (1–8), claves de rol
  // del enum, sesiones no vacías. Sin esto, un `slots` gigante o NaN corrompía la
  // cobertura o agotaba memoria al enumerar huecos.
  const parsed = rosterTemplateSchema.safeParse(body?.template);
  if (!parsed.success) {
    // El choque de códigos de sesión es corregible por el usuario, así que se
    // devuelve su mensaje en vez del genérico.
    const duplicate = parsed.error.issues.find((i) => i.code === "custom");
    return jsonError(duplicate?.message ?? "Plantilla inválida", 400);
  }
  const template = parsed.data as RosterSession[];

  const result = await dataService.saveCompetitionTemplate(
    competitionId,
    template,
    user.nombre,
  );
  if (!result) return jsonError("No se pudo guardar la plantilla", 500);
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
  if (!result) return jsonError("No se pudo borrar la plantilla", 500);
  return jsonOk(result);
}
