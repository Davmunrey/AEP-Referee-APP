import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function signOut(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  // 303 See Other: tras un POST, el redirect debe forzar un GET en el destino
  // (el 307 por defecto re-enviaría el POST a /sign-in).
  return NextResponse.redirect(`${origin}/sign-in`, 303);
}

// Solo POST: cerrar sesión es un cambio de estado. Exponerlo por GET permitía
// logout-CSRF (SameSite=Lax envía la cookie en navegaciones top-level GET).
export async function POST(request: Request) {
  return signOut(request);
}
