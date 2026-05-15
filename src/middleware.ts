import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = [
  "/login",
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/auth/switch",
  "/api/v1/auth/demo-users",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/v1/auth/")) {
    const session = request.cookies.get("aep_session")?.value;
    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api")) {
    const session = request.cookies.get("aep_session")?.value;
    if (!session) {
      const login = new URL("/login", request.url);
      login.searchParams.set("from", pathname);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
