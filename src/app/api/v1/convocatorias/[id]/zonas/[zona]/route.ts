import { z } from "zod";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { canManageJudges } from "@/lib/auth/session";
import { resolverZona } from "@/server/convocatorias";

const bodySchema = z.object({ aceptar: z.boolean() });

/**
 * El delegado de la zona invitada (o la gestión nacional) acepta o rechaza que
 * sus jueces vean la convocatoria. El permiso por zona (`user.role`/zona) lo
 * comprueba `resolverZona`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; zona: string }> }) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  // Gestores de jueces (nacionales y delegados de zona); qué zona puede
  // responder cada uno lo decide `resolverZona`.
  if (!canManageJudges(user)) return jsonError("Sin permiso", 403);
  const { id, zona } = await params;
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Indica si aceptas", 400);
  try {
    await resolverZona(user, id, decodeURIComponent(zona), body.data.aceptar);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonRouteError("convocatoria.zona.POST", err, "No se pudo guardar la respuesta");
  }
}
