import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { assertRefereeInUserZone } from "@/lib/api/referee-scope";
import { jsonError, jsonOk, jsonServerError, readOrError } from "@/lib/api/route-utils";
import { canManageJudges } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { revokeJudgeAccess } from "@/server/services/judge-accounts";

/** Retira el acceso al portal de un juez. Se puede volver a invitar. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageJudges(user)) return jsonError("Sin permiso", 403);
  const { id } = await params;
  const scope = await assertRefereeInUserZone(user, id);
  if (scope) return scope;

  const referee = await readOrError("portal-access.DELETE", "No se pudo cargar el juez", () =>
    dataService.getReferee(id),
  );
  if (referee instanceof Response) return referee;
  if (!referee) return jsonError("Juez no encontrado", 404);
  try {
    const revoked = await revokeJudgeAccess(referee);
    if (!revoked) return jsonError("Este juez no tiene acceso al portal", 404);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonServerError("portal-access.DELETE", err, "No se pudo retirar el acceso");
  }
}
