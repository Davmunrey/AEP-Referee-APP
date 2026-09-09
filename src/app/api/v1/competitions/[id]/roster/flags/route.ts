import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { loadCompetitionForRosterWrite } from "@/lib/api/roster-mutation-guard";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import type { SlotFlags } from "@/lib/types";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await loadCompetitionForRosterWrite(competitionId, user, "roster.flags");
  if (comp instanceof Response) return comp;

  const body = await request.json().catch(() => null);
  const slotKey = body?.slotKey ? String(body.slotKey) : "";
  if (!slotKey) return jsonError("slotKey requerido", 400);

  const flags: SlotFlags = {
    compartido: Boolean(body?.flags?.compartido),
    intercambio: Boolean(body?.flags?.intercambio),
  };

  // Ídem que `roster/assign`: las lecturas de debajo lanzan y aquí no había
  // dónde caer.
  try {
    const result = await dataService.setSlotFlags(competitionId, slotKey, flags, user.nombre);
    if ("error" in result && result.error) return jsonError(result.error, 400);
    return jsonOk(result);
  } catch (err) {
    return jsonServerError("roster.flags", err, "No se pudo guardar la marca del hueco");
  }
}
