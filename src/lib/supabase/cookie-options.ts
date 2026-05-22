export const SUPABASE_AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export const supabaseCookieOptions = {
  maxAge: SUPABASE_AUTH_COOKIE_MAX_AGE,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
