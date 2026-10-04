import { isSessionUser, requireJudgeUser } from "@/lib/api/auth";
import { jsonOk, readOrError } from "@/lib/api/route-utils";
import { convocatoriasParaJuez } from "@/server/convocatorias";

/** Convocatorias abiertas para el juez de la sesión. */
export async function GET() {
  const judge = await requireJudgeUser();
  if (!isSessionUser(judge)) return judge;
  const list = await readOrError("portal.convocatorias.GET", "No se pudieron cargar las convocatorias", () =>
    convocatoriasParaJuez(judge.refereeId),
  );
  if (list instanceof Response) return list;
  return jsonOk(list);
}
