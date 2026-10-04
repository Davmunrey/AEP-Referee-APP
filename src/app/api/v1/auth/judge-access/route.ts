import { z } from "zod";
import {
  canAttemptLogin,
  MAX_LOGIN_EMAIL_LENGTH,
  recordFailedLogin,
  requestIp,
} from "@/lib/api/login-rate-limit";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { AEP_TARIMA_SITE_URL } from "@/lib/auth/supabase-email-branding";
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
  if (!limit.allowed) {
    return jsonError("Demasiados intentos. Espera unos minutos antes de reintentar.", 429);
  }
  recordFailedLogin(ip, body.data.email);

  try {
    // La vuelta del enlace es la URL configurada del sitio, no el origen de la
    // petición: en una ruta pública ese origen sale de la cabecera Host, que
    // pone quien llama.
    await requestJudgeAccess(body.data.email, `${AEP_TARIMA_SITE_URL}/`);
  } catch (err) {
    // Se registra y se responde igual: un error distinto delataría que el
    // e-mail sí estaba en el censo.
    console.error("[auth.judge-access]", err);
  }
  return jsonOk({ message: RESPUESTA });
}
