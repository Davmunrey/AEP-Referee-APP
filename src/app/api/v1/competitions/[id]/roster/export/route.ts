import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { assertCompetitionInUserZone } from "@/lib/api/referee-scope";
import { jsonError, jsonRouteError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id } = await context.params;
  const scopeErr = await assertCompetitionInUserZone(user, id);
  if (scopeErr) return scopeErr;
  let text: string | null | undefined;
  try {
    text = await dataService.exportRoster(id);
  } catch (err) {
    return jsonRouteError("roster.export", err, "No se pudo exportar la tarima");
  }
  if (!text) return jsonError("Competición no encontrada", 404);

  return new Response(text, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="roster-${id}.txt"`,
    },
  });
}
