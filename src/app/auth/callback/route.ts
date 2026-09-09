import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    // El texto del proveedor no se reenvía al navegador: llega por la URL, así
    // que lo escribe quien manda el enlace, y acababa pintado en la pantalla de
    // acceso con el aspecto de un mensaje oficial de la aplicación.
    console.error("[auth.callback]", errorDescription);
    return NextResponse.redirect(`${origin}/sign-in?error=enlace-invalido`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth.callback.exchange]", error.message);
    return NextResponse.redirect(`${origin}/sign-in?error=sesion-fallida`);
  }

  // El perfil de la app se crea automáticamente en getSession() al cargar el panel.
  return NextResponse.redirect(`${origin}/`);
}
