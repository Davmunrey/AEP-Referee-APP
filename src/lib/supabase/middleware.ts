import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

const PUBLIC_PATHS = [
  "/sign-in",
  "/sign-up",
  "/auth/callback",
  "/login",
  "/docs",
  "/api/v1/auth",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh session — do not add logic between createServerClient and getUser.
  // Si el token de refresco está caducado/ausente, getUser() lanza
  // AuthApiError (refresh_token_not_found): no es un fallo real, solo una sesión
  // expirada, así que lo tratamos como "no autenticado" y redirigimos a login
  // en vez de dejar que reviente el middleware (ruido en la monitorización).
  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch {
    user = null;
  }
  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const signIn = new URL("/sign-in", request.url);
    return NextResponse.redirect(signIn);
  }

  if (user && (pathname === "/sign-in" || pathname === "/sign-up" || pathname === "/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}
