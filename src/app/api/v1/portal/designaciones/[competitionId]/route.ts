import { z } from "zod";
import { isSessionUser, requireJudgeUser } from "@/lib/api/auth";
import { jsonError, jsonOk, jsonRouteError } from "@/lib/api/route-utils";
import { responderDesignacion } from "@/server/convocatorias";

const bodySchema = z.object({
  estado: z.enum(["confirmada", "rechazada"]),
  motivo: z.string().max(500).optional(),
});

/** El juez de la sesión confirma que va a su designación o dice que no puede. */
export async function POST(req: Request, { params }: { params: Promise<{ competitionId: string }> }) {
  const judge = await requireJudgeUser();
  if (!isSessionUser(judge)) return judge;
  const { competitionId } = await params;
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Respuesta no válida", 400);
  try {
    await responderDesignacion(judge.refereeId, competitionId, body.data.estado, body.data.motivo);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonRouteError("portal.designacion.POST", err, "No se pudo guardar tu respuesta");
  }
}
