import { canEditRoster } from "@/lib/auth/session";
import { assertCompetitionInUserZone } from "@/lib/api/referee-scope";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, readOrError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import { z } from "zod";

const bodySchema = z.object({ refereeId: z.string().min(1) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  const { id } = await params;
  const scopeError = await assertCompetitionInUserZone(user, id);
  if (scopeError) return scopeError;
  // Ver `competitions.GET`: el servicio distingue a propósito «nadie ha
  // confirmado» de «no se pudo leer», y aquí el segundo volvía a salir como un
  // 500 sin sobre y sin nombre en el log.
  const confirmedIds = await readOrError(
    "availability.GET",
    "No se pudieron cargar las confirmaciones",
    () => dataService.getCompetitionAvailability(id),
  );
  if (confirmedIds instanceof Response) return confirmedIds;
  return jsonOk({ confirmedIds });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role === "solo_ver") return jsonError("Sin permiso", 403);

  const { id } = await params;

  // Delegados de zona solo pueden gestionar disponibilidad en su propia zona
  const comp = await readOrError("availability.POST.comp", "No se pudo cargar el campeonato", () =>
    dataService.getCompetition(id),
  );
  if (comp instanceof Response) return comp;
  if (!comp) return jsonError("Competición no encontrada", 404);
  if (!canEditRoster(user, comp.zona)) return jsonError("Sin permiso en esta zona", 403);

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Cuerpo de solicitud inválido", 400);

  // Un juez inexistente violaba la FK en la BD y salía como 500 genérico.
  const referee = await readOrError("availability.POST", "No se pudo cargar el juez", () =>
    dataService.getReferee(body.data.refereeId),
  );
  if (referee instanceof Response) return referee;
  if (!referee) return jsonError("Juez no encontrado", 404);

  try {
    await dataService.addCompetitionAvailability(id, body.data.refereeId, user.nombre);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonServerError("availability.POST", err, "No se pudo guardar la disponibilidad");
  }
}
