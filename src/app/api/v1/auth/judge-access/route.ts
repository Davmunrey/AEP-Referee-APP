import { z } from "zod";
import {
  canAttemptLogin,
  MAX_LOGIN_EMAIL_LENGTH,
  recordFailedLogin,
  requestIp,
} from "@/lib/api/login-rate-limit";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { allowAction } from "@/lib/api/action-rate-limit";
import { afterResponse } from "@/lib/after-response";
import { requestJudgeAccess } from "@/server/services/judge-accounts";

const bodySchema = z.object({ email: z.string().trim().min(3).max(MAX_LOGIN_EMAIL_LENGTH) });

/** Lo mismo pase lo que pase: la respuesta no dice si el e-mail es de un juez. */
const RESPUESTA =
  "Petición enviada. Si ese e-mail figura en el censo, tu delegado de zona la verá en la aplicación y te dará un código para entrar.";

/**
 * Pública: un juez sin código pide acceso con el e-mail del censo. No se le
 * envía nada: su delegado recibe un aviso en la campana.
 */
export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Escribe un e-mail válido", 400);

  // Límite por e-mail y por IP: sin ellos se podría llenar la campana de un
  // delegado o probar e-mails en serie.
  const ip = requestIp(request);
  const limit = canAttemptLogin(ip, body.data.email);
  if (!limit.allowed || !allowAction(`judge-access:ip:${ip}`, 20, 15 * 60_000)) {
    return jsonError("Demasiados intentos. Espera unos minutos antes de reintentar.", 429);
  }
  recordFailedLogin(ip, body.data.email);

  // Después de responder: si se esperara, la respuesta tardaría más cuando el
  // e-mail SÍ es de un juez y el tiempo delataría lo que el texto calla.
  const email = body.data.email;
  afterResponse(() => requestJudgeAccess(email).catch((err) => console.error("[auth.judge-access]", err)));
  return jsonOk({ message: RESPUESTA });
}
