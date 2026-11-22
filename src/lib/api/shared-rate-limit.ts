import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Contadores de intentos compartidos entre instancias (tabla
 * `rate_limit_hits`, migración 046).
 *
 * Los límites en memoria (`login-rate-limit`, `action-rate-limit`) se quedan
 * como primera barrera: son instantáneos y siguen funcionando sin base. Pero
 * en Vercel cada instancia tiene su memoria y un arranque en frío la vacía, así
 * que por sí solos no frenaban a quien repartiera intentos entre instancias.
 *
 * Si la base no responde, o la migración aún no está aplicada, estas funciones
 * se comportan como «sin datos» y deciden los límites en memoria: un fallo de
 * infraestructura no debe dejar a nadie sin poder entrar.
 *
 * La clave se resume con SHA-256 antes de salir del servidor: la tabla no
 * guarda e-mails ni IPs en claro.
 */

export function sharedKey(key: string): string {
  return `rl:${createHash("sha256").update(key).digest("hex")}`;
}

let avisado = false;

function sinLimiteCompartido(err: unknown): void {
  // Una vez por instancia: si la migración falta, cada petición lo repetiría.
  if (avisado) return;
  avisado = true;
  console.error(
    "[rate-limit.shared] sin límite compartido, solo el de memoria:",
    err instanceof Error ? err.message : err,
  );
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createAdminClient().rpc(fn, args);
    if (error) {
      sinLimiteCompartido(error);
      return null;
    }
    return data as T;
  } catch (err) {
    sinLimiteCompartido(err);
    return null;
  }
}

/** Intentos de la clave en su ventana vigente (0 si no hay datos). */
export async function sharedPeek(key: string): Promise<number> {
  const n = await rpc<number>("rate_limit_peek", { p_key: sharedKey(key) });
  return typeof n === "number" ? n : 0;
}

/** Suma un intento y devuelve los que lleva (0 si no hay datos). */
export async function sharedHit(key: string, windowSeconds: number): Promise<number> {
  const n = await rpc<number>("rate_limit_hit", {
    p_key: sharedKey(key),
    p_window_seconds: Math.max(1, Math.round(windowSeconds)),
  });
  return typeof n === "number" ? n : 0;
}

export async function sharedClear(key: string): Promise<void> {
  await rpc("rate_limit_clear", { p_key: sharedKey(key) });
}

/** Para las pruebas. */
export function resetSharedRateLimitWarning(): void {
  avisado = false;
}
