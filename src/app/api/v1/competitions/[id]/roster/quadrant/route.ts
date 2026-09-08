import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { assertCompetitionInUserZone } from "@/lib/api/referee-scope";
import { jsonError } from "@/lib/api/route-utils";
import { generateQuadrantHtml } from "@/lib/quadrant-html";
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
  // Vía dataService y no con el cliente de Supabase a pelo: la ruta reventaba
  // con un 500 en el backend en memoria (sin SUPABASE_SERVICE_ROLE_KEY), que es
  // el modo de desarrollo y el de las capturas del manual.
  let refMap: Map<string, { nombre: string; nivel: string }>;
  try {
    refMap = await dataService.getRefereesByIds(assignedIds);
  } catch {
    // Sin nombres no hay cuadrante: las filas de rol se omiten cuando todas sus
    // celdas quedan vacías, así que un fallo de lectura devolvía un documento
    // con los días y las sesiones pero sin un solo juez —con aspecto de válido,
    // y camino de la impresora y de la sede.
    return jsonError(
      "No se pudieron leer los jueces designados. Vuelve a intentarlo antes de imprimir el cuadrante.",
      503,
    );
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
