import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { removeDeviceToken } from "@/server/notifications/device-tokens";

/** DELETE /api/v1/devices/:token — da de baja el token APNs (logout). */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { token } = await ctx.params;
  const apnsToken = decodeURIComponent(token ?? "").trim();
  if (!apnsToken) return jsonError("token requerido", 400);

  await removeDeviceToken(user.id, apnsToken);
  return jsonOk({ deleted: true });
}
