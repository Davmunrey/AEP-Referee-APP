import type { ActivityItem } from "@/lib/types";
import { pushActivity } from "./supabase-helpers";

/**
 * Deja constancia de un cambio de acceso (alta de cuenta, cambio de rol,
 * reseteo de contraseña, baja) sin poder tumbar la operación.
 *
 * El registro va DESPUÉS de la escritura real: si fallara y se propagase, la
 * ruta contestaría error sobre algo que ya se hizo —y quien lo pidió creería
 * que no había pasado nada—. Se avisa por el log del servidor y se sigue.
 */
export async function recordAccessChange(item: Omit<ActivityItem, never>): Promise<void> {
  try {
    await pushActivity(item);
  } catch (error) {
    console.warn(
      `[admin] cambio de acceso sin registrar (${item.accion} ${item.evento}):`,
      error instanceof Error ? error.message : error,
    );
  }
}
