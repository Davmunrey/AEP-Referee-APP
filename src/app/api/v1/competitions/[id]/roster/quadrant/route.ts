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

  const search = new URL(request.url).searchParams;
  const autoPrint = search.get("print") === "1";
  const embed = search.get("embed") === "1";
  const { id } = await context.params;
  const scopeErr = await assertCompetitionInUserZone(user, id);
  if (scopeErr) return scopeErr;

  const [roster, comp] = await Promise.all([
    dataService.getRoster(id),
    dataService.getCompetition(id),
  ]);

  if (!roster || !comp) return jsonError("Competición no encontrada", 404);

  // Solo hacen falta los jueces asignados a la tarima, no el censo completo.
  const assignedIds = [...new Set(Object.values(roster.assignments ?? {}).filter(Boolean))];
  const refMap = new Map<string, { id: string; nombre: string; nivel: string }>();
  if (assignedIds.length > 0) {
    const supabase = createAdminClient();
    const { data: referees } = await supabase
      .from("referees")
      .select("id, nombre, nivel")
      .in("id", assignedIds)
      .returns<Array<{ id: string; nombre: string; nivel: string }>>();
    for (const r of referees ?? []) refMap.set(r.id, r);
  }

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
    embed,
  );

  return new Response(html, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
