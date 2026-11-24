"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Llama a `onChange` en el mismo render en que `value` cambia respecto al
 * render anterior (comparación con `Object.is`).
 *
 * Es el patrón que recomienda React para «ajustar el estado cuando cambia una
 * prop» en lugar de un `useEffect` que hace `setState`: el efecto pintaba
 * primero con el estado viejo y luego otra vez con el nuevo, y la regla
 * `react-hooks/set-state-in-effect` lo marca. Aquí React descarta el render en
 * curso y lo repite ya con el estado ajustado, sin llegar a pintarlo.
 *
 * `onChange` solo debe actualizar estado de ESTE componente.
 */
export function usePropChange<T>(value: T, onChange: (next: T, prev: T) => void): void {
  const [prev, setPrev] = useState(value);
  if (!Object.is(prev, value)) {
    setPrev(value);
    onChange(value, prev);
  }
}

/**
 * Estado local que parte de lo que manda el servidor y vuelve a ello cada vez
 * que llega una versión nueva (p. ej. tras `router.refresh()`), conservando
 * mientras tanto los cambios optimistas del cliente.
 */
export function useServerState<T>(source: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(source);
  usePropChange(source, (next) => setState(next));
  return [state, setState];
}
