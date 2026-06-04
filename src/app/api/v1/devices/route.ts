import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { registerDeviceToken } from "@/server/notifications/device-tokens";

/** POST /api/v1/devices — registra/actualiza el token APNs del cliente nativo. */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Cuerpo JSON inválido", 400);
  }

  const apnsToken = body.apnsToken;
  if (typeof apnsToken !== "string" || apnsToken.trim().length === 0) {
    return jsonError("apnsToken requerido", 400);
  }
  const token = apnsToken.trim();
  // Un device token APNs es hexadecimal (32 bytes → 64 hex; margen hasta 200).
  if (!/^[0-9a-fA-F]{64,200}$/.test(token)) {
    return jsonError("apnsToken inválido", 400);
  }

  const environment = body.environment === "sandbox" ? "sandbox" : "production";
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : undefined);

  await registerDeviceToken({
    userId: user.id,
    apnsToken: token,
    environment,
    deviceModel: str(body.deviceModel),
    appVersion: str(body.appVersion),
    locale: str(body.locale),
  });

  return jsonOk({ registered: true });
}
