import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id } = await context.params;
  const text = dataService.exportRoster(id);
  if (!text) return jsonError("Competición no encontrada", 404);

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="roster-${id}.txt"`,
    },
  });
}
