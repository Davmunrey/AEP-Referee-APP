import { z } from "zod";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { assertCompetitionInUserZone } from "@/lib/api/referee-scope";
import { jsonError, jsonOk, jsonRouteError, readOrError } from "@/lib/api/route-utils";
import { canEditRoster } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { actualizarConvocatoria, crearConvocatoria, getConvocatoriaDeCampeonato } from "@/server/convocatorias";

type Ctx = { params: Promise<{ id: string }> };

/** La convocatoria del campeonato y sus inscripciones. */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await params;
  const scope = await assertCompetitionInUserZone(user, id);
  if (scope) return scope;
  const view = await readOrError("convocatoria.GET", "No se pudo cargar la convocatoria", () =>
    getConvocatoriaDeCampeonato(id),
  );
  if (view instanceof Response) return view;
  return jsonOk(view);
}

async function loadForWrite(id: string, user: Parameters<typeof canEditRoster>[0]) {
  const data = await readOrError("convocatoria.campeonato", "No se pudo cargar el campeonato", () =>
    dataService.getCompetitionWithRoster(id),
  );
  if (data instanceof Response) return data;
  if (!data) return jsonError("Campeonato no encontrado", 404);
  if (!canEditRoster(user, data.competition.zona)) return jsonError("Sin permiso en este campeonato", 403);
  return data;
}

const createSchema = z.object({
  sesiones: z.array(z.string().min(1)).min(1).max(50),
  cierraEl: z.string(),
  mensaje: z.string().max(1000).optional(),
});

/** Lanza la convocatoria (gestores de la tarima del campeonato). */
export async function POST(req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await params;
  const data = await loadForWrite(id, user);
  if (data instanceof Response) return data;
  const body = createSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Datos de la convocatoria no válidos", 400);
  try {
    const convocatoria = await crearConvocatoria(user, data.competition, data.roster.template, body.data);
    return jsonOk({ convocatoria, inscripciones: [] }, { status: 201 });
  } catch (err) {
    return jsonRouteError("convocatoria.POST", err, "No se pudo lanzar la convocatoria");
  }
}

const patchSchema = z.object({
  estado: z.enum(["abierta", "cerrada", "cancelada"]).optional(),
  cierraEl: z.string().optional(),
  mensaje: z.string().max(1000).optional(),
  sesiones: z.array(z.string().min(1)).min(1).max(50).optional(),
});

/** Cerrar, reabrir, cancelar o cambiar fecha, mensaje o sesiones. */
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await params;
  const data = await loadForWrite(id, user);
  if (data instanceof Response) return data;
  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Cambios no válidos", 400);
  try {
    const current = await dataService.getLiveConvocatoria(id);
    if (!current) return jsonError("Este campeonato no tiene convocatoria", 404);
    const convocatoria = await actualizarConvocatoria(current, data.competition, data.roster.template, body.data);
    return jsonOk({ convocatoria, inscripciones: await dataService.listInscripciones(convocatoria.id) });
  } catch (err) {
    return jsonRouteError("convocatoria.PATCH", err, "No se pudo guardar la convocatoria");
  }
}
