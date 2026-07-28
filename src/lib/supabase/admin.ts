import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

function buildAdminClient() {
  const key = getSupabaseServiceRoleKey();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada");
  }
  return createClient(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Singleton a nivel de módulo: el cliente admin es sin estado de sesión
// (persistSession: false, autoRefreshToken: false), así que es seguro
// reutilizar una única instancia por proceso en vez de crear cliente (y pool
// de conexiones HTTP) en cada llamada.
let adminClient: ReturnType<typeof buildAdminClient> | null = null;

/** Cliente con service role — solo en servidor, nunca exponer al cliente. */
export function createAdminClient() {
  adminClient ??= buildAdminClient();
  return adminClient;
}
