import { isSessionUser, requireJudgeUser } from "@/lib/api/auth";
import { jsonError, jsonOk, readOrError } from "@/lib/api/route-utils";
import { convocatoriaParaJuez } from "@/server/convocatorias";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const judge = await requireJudgeUser();
  if (!isSessionUser(judge)) return judge;
  const { id } = await params;
  const view = await readOrError("portal.convocatoria.GET", "No se pudo cargar la convocatoria", () =>
    convocatoriaParaJuez(judge.refereeId, id),
  );
  if (view instanceof Response) return view;
  if (!view) return jsonError("Convocatoria no encontrada", 404);
  return jsonOk(view);
}
