/**
 * Estado de las cuentas de juez en el modo local (sin Supabase): qué cuentas
 * tienen el acceso activo. Aparte de `judge-accounts.ts` para que
 * `destinatarios.ts` lo lea sin importar el servicio entero (que a su vez
 * importa `destinatarios`).
 */
export const memoryJudgeActive = new Map<string, boolean>();

/** ¿Cuenta de juez activa? (memoria; en Supabase lo dice `profiles.activo`). */
export function isMemoryJudgeAccountActive(userId: string): boolean {
  return memoryJudgeActive.get(userId) !== false;
}
