import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { guardRosterWrite } from "@/lib/api/roster-mutation-guard";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import type { SlotFlags } from "@/lib/types";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await dataService.getCompetition(competitionId);
  const blocked = guardRosterWrite(comp, user);
  if (blocked) return blocked;
  if (!comp) return jsonError("Competición no encontrada", 404);

  const body = await request.json().catch(() => null);
  const slotKey = body?.slotKey ? String(body.slotKey) : "";
  if (!slotKey) return jsonError("slotKey requerido", 400);

  const flags: SlotFlags = {
    compartido: Boolean(body?.flags?.compartido),
    intercambio: Boolean(body?.flags?.intercambio),
  };

  const result = await dataService.setSlotFlags(competitionId, slotKey, flags, user.nombre);
  if ("error" in result && result.error) return jsonError(result.error, 400);
  return jsonOk(result);
}
