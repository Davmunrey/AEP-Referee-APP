import { z } from "zod";
import {
  canAttemptLogin,
  MAX_LOGIN_EMAIL_LENGTH,
  recordFailedLogin,
  requestIp,
} from "@/lib/api/login-rate-limit";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { AEP_TARIMA_SITE_URL } from "@/lib/auth/supabase-email-branding";
import { allowAction } from "@/lib/api/action-rate-limit";
import { afterResponse } from "@/lib/after-response";
import { requestJudgeAccess } from "@/server/services/judge-accounts";

const bodySchema = z.object({ email: z.string().trim().min(3).max(MAX_LOGIN_EMAIL_LENGTH) });

/** Lo mismo pase lo que pase: la respuesta no dice si el e-mail es de un juez. */
const RESPUESTA =
  "Si ese e-mail figura en el censo de jueces, te llegará un enlace para entrar en unos minutos. Revisa también la carpeta de spam.";

/**
 * Pública: un juez pide su enlace de acceso con el e-mail del censo. Sirve
 * tanto para la primera vez (crea la cuenta) como para volver a entrar.
 */
export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Escribe un e-mail válido", 400);

  // Cada petición cuenta como intento: cada una puede enviar un correo, y sin
  // tope serviría para bombardear el buzón de un juez.
  const ip = requestIp(request);
  const limit = canAttemptLogin(ip, body.data.email);
  // Además del límite por e-mail, uno por IP: sin él se podían probar muchos
  // e-mails distintos desde el mismo sitio.
  if (!limit.allowed || !allowAction(`judge-access:ip:${ip}`, 20, 15 * 60_000)) {
    return jsonError("Demasiados intentos. Espera unos minutos antes de reintentar.", 429);
  }
  recordFailedLogin(ip, body.data.email);

  // Después de responder: si se esperara, la respuesta tardaría más cuando el
  // e-mail SÍ es de un juez (consulta de perfiles, envío del correo) y el
  // tiempo delataría lo que el texto calla.
  // La vuelta del enlace es la URL configurada del sitio, no el origen de la
  // petición: en una ruta pública ese origen sale de la cabecera Host.
  const email = body.data.email;
  afterResponse(() =>
    requestJudgeAccess(email, `${AEP_TARIMA_SITE_URL}/`).catch((err) => console.error("[auth.judge-access]", err)),
  );
  return jsonOk({ message: RESPUESTA });
}
