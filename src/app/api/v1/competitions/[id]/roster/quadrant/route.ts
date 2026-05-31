import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { assertCompetitionInUserZone } from "@/lib/api/referee-scope";
import { jsonError } from "@/lib/api/route-utils";
import { generateQuadrantHtml } from "@/lib/quadrant-html";
import { createAdminClient } from "@/lib/supabase/admin";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const autoPrint = new URL(request.url).searchParams.get("print") === "1";
  const { id } = await context.params;
  const scopeErr = await assertCompetitionInUserZone(user, id);
  if (scopeErr) return scopeErr;

  const [roster, comp] = await Promise.all([
    dataService.getRoster(id),
    dataService.getCompetition(id),
  ]);

  if (!roster || !comp) return jsonError("Competición no encontrada", 404);

  const supabase = createAdminClient();
  const { data: referees } = await supabase
    .from("referees")
    .select("id, nombre, nivel")
    .returns<Array<{ id: string; nombre: string; nivel: string }>>();
  const refMap = new Map((referees ?? []).map((r) => [r.id, r]));

  const html = generateQuadrantHtml(
    comp,
    roster.template,
    roster.assignments,
    (refId) => {
      const r = refMap.get(refId);
      return r ? { nombre: String(r.nombre), nivel: String(r.nivel) } : undefined;
    },
    roster.flags,
    autoPrint,
  );

  return new Response(html, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
