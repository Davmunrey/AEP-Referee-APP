import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { assertCompetitionInUserZone } from "@/lib/api/referee-scope";
import { jsonError, readOrError } from "@/lib/api/route-utils";
import { generateQuadrantExcel } from "@/lib/quadrant-excel";
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

  // Estas dos lecturas lanzan cuando la base no responde, y estaban fuera de
  // todo `try`: el fallo salía de Next como un 500 sin cuerpo, y quien había
  // pulsado «imprimir cuadrante» veía «Server error (500)». Sus hermanas
  // `roster/export` y `roster/history` ya usan el idioma común.
  const leido = await readOrError("roster.quadrant.xlsx", "No se pudo cargar el cuadrante", () =>
    Promise.all([dataService.getRoster(id), dataService.getCompetition(id)]),
  );
  if (leido instanceof Response) return leido;
  const [roster, comp] = leido;
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

  const buffer = generateQuadrantExcel(
    comp,
    roster.template,
    roster.assignments,
    (refId) => {
      const r = refMap.get(refId);
      return r ? { nombre: String(r.nombre), nivel: String(r.nivel) } : undefined;
    },
    roster.flags,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cuadrante-${id}.xlsx"`,
    },
  });
}
