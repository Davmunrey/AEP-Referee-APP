import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Se excluye /api: cada ruta aplica su propia autenticación vía requireApiUser
  // (que acepta cookie de sesión Y token Bearer del cliente nativo). Mantener el
  // middleware fuera de /api evita un segundo checkpoint solo-cookie que
  // bloqueaba las peticiones Bearer de la app móvil.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|[^?]*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};
