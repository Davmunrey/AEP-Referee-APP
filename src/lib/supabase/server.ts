import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isClerkConfigured } from "@/lib/clerk/env";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

/** Cliente Supabase con token de sesión Clerk (RLS con auth.jwt()->>'sub'). */
export async function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado");
  }

  if (isClerkConfigured()) {
    return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      async accessToken() {
        return (await auth()).getToken();
      },
    });
  }

  const cookieStore = await cookies();
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component
        }
      },
    },
  });
}
