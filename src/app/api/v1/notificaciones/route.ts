import { z } from "zod";
import { isSessionUser, requireAnyUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonRouteError, readOrError } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";

/** Los avisos de quien llama (self-service: solo los suyos). */
export async function GET() {
  const user = await requireAnyUser();
  if (!isSessionUser(user)) return user;
  const bandeja = await readOrError("notificaciones.GET", "No se pudieron cargar los avisos", () =>
    dataService.getBandejaNotificaciones(user.id),
  );
  if (bandeja instanceof Response) return bandeja;
  return jsonOk(bandeja);
}

const bodySchema = z.object({ ids: z.array(z.string().min(1)).max(100).optional() });

/** Marca como leídos sus avisos (todos o los indicados). */
export async function PATCH(req: Request) {
  const user = await requireAnyUser();
  if (!isSessionUser(user)) return user;
  const body = bodySchema.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!body.success) return jsonError("Petición no válida", 400);
  try {
    await dataService.marcarNotificacionesLeidas(user.id, body.data.ids);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonRouteError("notificaciones.PATCH", err, "No se pudieron marcar los avisos");
  }
}
