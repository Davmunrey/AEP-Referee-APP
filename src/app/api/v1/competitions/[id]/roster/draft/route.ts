import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { loadCompetitionForRosterWrite } from "@/lib/api/roster-mutation-guard";
import { jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id } = await context.params;
  const comp = await loadCompetitionForRosterWrite(id, user, "roster.draft");
  if (comp instanceof Response) return comp;

  try {
    await dataService.saveDraft(id, user.nombre);
  } catch (err) {
    return jsonRouteError("roster.draft", err, "No se pudo guardar el borrador");
  }
  return jsonOk({ message: "Borrador guardado" });
}
