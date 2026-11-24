import { type NextRequest } from "next/server";
import { buildPageCsp, generateNonce, NONCE_HEADER } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy de Next 16 (antes `middleware.ts`): corre antes de cada página, en el
 * runtime de Node. Renueva la sesión de Supabase y pone la CSP con nonce.
 */
export async function proxy(request: NextRequest) {
  // Nonce nuevo en cada petición. Viaja en la petición (Next lo lee de la
  // cabecera CSP para marcar sus propios scripts, y `app/layout.tsx` de
  // `x-nonce` para el de arranque del tema) y en la respuesta, que es la que
  // hace cumplir el navegador.
  const nonce = generateNonce();
  const csp = buildPageCsp(nonce);
  const response = await updateSession(request, {
    [NONCE_HEADER]: nonce,
    "content-security-policy": csp,
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Se excluye /api: cada ruta aplica su propia autenticación vía requireApiUser.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|[^?]*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};
