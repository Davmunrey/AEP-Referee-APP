import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Cliente Supabase sin sesión persistente, para verificar los tokens de
 * acceso que presentan los clientes nativos (app móvil) en la cabecera
 * `Authorization: Bearer <jwt>`. La web sigue usando la sesión por cookie.
 */
export function createTokenClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Caché en memoria token -> usuario para amortizar la verificación remota en
// rutas calientes. TTL corto a propósito: la baja de un perfil (activo=false)
// se comprueba aparte en cada request, contra la tabla profiles.
const TTL_MS = 60_000;
const MAX_ENTRIES = 1000;
const cache = new Map<string, { user: User; expiresAt: number }>();

function prune(now: number) {
  for (const [token, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(token);
  }
}

/** Verifica un JWT de Supabase y devuelve el usuario, o null si es inválido. */
export async function verifyAccessToken(token: string): Promise<User | null> {
  const now = Date.now();
  const hit = cache.get(token);
  if (hit && hit.expiresAt > now) return hit.user;
  if (hit) cache.delete(token);

  const client = createTokenClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  if (cache.size >= MAX_ENTRIES) prune(now);
  cache.set(token, { user: data.user, expiresAt: now + TTL_MS });
  return data.user;
}

/** Solo para tests: vacía la caché de verificación. */
export function __clearTokenCache() {
  cache.clear();
}
