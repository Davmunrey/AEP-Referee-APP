import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { assertRefereeInUserZone } from "@/lib/api/referee-scope";
import { jsonError, jsonOk, jsonServerError, readOrError } from "@/lib/api/route-utils";
import { canManageJudges } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { issueAccessCodes, revokeJudgeAccess } from "@/server/services/judge-accounts";

type Params = { params: Promise<{ id: string }> };

async function loadScoped(id: string) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageJudges(user)) return jsonError("Sin permiso", 403);
  const scope = await assertRefereeInUserZone(user, id);
  if (scope) return scope;
  const referee = await readOrError("portal-access", "No se pudo cargar el juez", () => dataService.getReferee(id));
  if (referee instanceof Response) return referee;
  if (!referee) return jsonError("Juez no encontrado", 404);
  return { user, referee };
}

/**
 * Da acceso (o un código nuevo, si ya lo tenía) a un juez desde su ficha. El
 * código solo vuelve en esta respuesta; uno nuevo anula el anterior.
 */
export async function POST(_request: Request, { params }: Params) {
  const loaded = await loadScoped((await params).id);
  if (loaded instanceof Response) return loaded;
  try {
    const [result] = await issueAccessCodes([loaded.referee], loaded.user.id);
    return jsonOk({ result });
  } catch (err) {
    return jsonServerError("portal-access.POST", err, "No se pudo generar el código");
  }
}

/** Retira el acceso al portal de un juez (y anula su código pendiente). */
export async function DELETE(_request: Request, { params }: Params) {
  const loaded = await loadScoped((await params).id);
  if (loaded instanceof Response) return loaded;
  try {
    const revoked = await revokeJudgeAccess(loaded.referee);
    if (!revoked) return jsonError("Este juez no tiene acceso al portal", 404);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonServerError("portal-access.DELETE", err, "No se pudo retirar el acceso");
  }
}
