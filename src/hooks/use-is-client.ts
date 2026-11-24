"use client";

import { useSyncExternalStore } from "react";

const sinCambios = () => () => {};

/**
 * `false` en el servidor y durante la hidratación; `true` en el cliente desde
 * el primer render posterior. Sustituye al patrón `useEffect(() =>
 * setMounted(true), [])`, que pintaba dos veces.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    sinCambios,
    () => true,
    () => false,
  );
}
