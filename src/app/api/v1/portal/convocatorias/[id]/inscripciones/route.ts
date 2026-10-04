import { z } from "zod";
import { isSessionUser, requireJudgeUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { apuntarse, retirarse } from "@/server/convocatorias";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({ sesion: z.string().min(1).max(100), nota: z.string().max(500).optional() });

/** El juez de la sesión se apunta a una sesión de la convocatoria. */
export async function POST(req: Request, { params }: Ctx) {
  const judge = await requireJudgeUser();
  if (!isSessionUser(judge)) return judge;
  const { id } = await params;
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Indica la sesión", 400);
  try {
    return jsonOk(await apuntarse(judge.refereeId, id, body.data.sesion, body.data.nota));
  } catch (err) {
    return jsonRouteError("portal.inscripcion.POST", err, "No se pudo guardar tu inscripción");
  }
}

/** Se retira de una sesión (`?sesion=S1`). */
export async function DELETE(req: Request, { params }: Ctx) {
  const judge = await requireJudgeUser();
  if (!isSessionUser(judge)) return judge;
  const { id } = await params;
  const sesion = new URL(req.url).searchParams.get("sesion");
  if (!sesion) return jsonError("Indica la sesión", 400);
  try {
    return jsonOk(await retirarse(judge.refereeId, id, sesion));
  } catch (err) {
    return jsonRouteError("portal.inscripcion.DELETE", err, "No se pudo retirar tu inscripción");
  }
}
