import { z } from "zod";
import {
  canAttemptLogin,
  clearLoginAttempts,
  MAX_LOGIN_EMAIL_LENGTH,
  recordFailedLogin,
  requestIp,
} from "@/lib/api/login-rate-limit";
import { jsonError, jsonOk, jsonServerError } from "@/lib/api/route-utils";
import { allowAction } from "@/lib/api/action-rate-limit";
import { JUDGE_PASSWORD_MIN } from "@/lib/judge-access";
import { redeemAccessCode } from "@/server/services/judge-accounts";

const bodySchema = z.object({
  email: z.string().trim().min(3).max(MAX_LOGIN_EMAIL_LENGTH),
  code: z.string().trim().min(8).max(20),
  password: z.string().min(1).max(200),
});

/**
 * Pública: el juez canjea el código que le dio su delegado y crea su
 * contraseña. Después la pantalla entra con e-mail y contraseña como
 * cualquier otra cuenta.
 *
 * Tres frenos al tanteo: límite por e-mail y por IP aquí, y el propio código
 * se anula tras unos pocos intentos fallidos (ver `redeemAccessCode`).
 */
export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Escribe tu e-mail, el código y una contraseña", 400);

  const ip = requestIp(request);
  const limit = canAttemptLogin(ip, body.data.email);
  if (!limit.allowed || !allowAction(`judge-code:ip:${ip}`, 20, 15 * 60_000)) {
    return jsonError("Demasiados intentos. Espera unos minutos antes de reintentar.", 429);
  }

  try {
    const outcome = await redeemAccessCode(body.data.email, body.data.code, body.data.password);
    if (outcome === "contrasena-corta") {
      return jsonError(`La contraseña debe tener al menos ${JUDGE_PASSWORD_MIN} caracteres`, 400);
    }
    if (outcome !== "ok") {
      recordFailedLogin(ip, body.data.email);
      return jsonError(
        "El e-mail o el código no son correctos, o el código ha caducado. Si no te funciona, pide uno nuevo a tu delegado.",
        400,
      );
    }
    clearLoginAttempts(ip, body.data.email);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonServerError("auth.judge-code", err, "No se pudo completar el acceso");
  }
}
