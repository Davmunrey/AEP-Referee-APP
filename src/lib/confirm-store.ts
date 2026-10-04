/**
 * Estado de la confirmación de la app (`confirmar()`), aparte del componente
 * que la pinta (`components/ui/confirm-dialog.tsx`) para poder probarlo sin
 * navegador.
 *
 * Se usa como el `window.confirm` nativo, con `await`, desde cualquier
 * manejador:
 *
 *   if (!(await confirmar({ titulo: "¿Eliminar este examen?", accion: "Eliminar", peligro: true }))) return;
 */
export interface ConfirmOptions {
  titulo: string;
  /** Qué pasa si se confirma; una o dos frases. */
  detalle?: string;
  /** Texto del botón que confirma: el verbo de la acción. */
  accion?: string;
  /** Texto del botón que no hace nada. */
  cancelar?: string;
  /** Acción destructiva: botón rojo y el foco empieza en «Cancelar». */
  peligro?: boolean;
}

export type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void };

let current: PendingConfirm | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function confirmar(options: ConfirmOptions): Promise<boolean> {
  // Sin anfitrión montado (un render fuera del layout) se comporta como el
  // nativo para no dejar la acción colgada; sin navegador, no confirma.
  if (listeners.size === 0) {
    const text = options.detalle ? `${options.titulo}\n\n${options.detalle}` : options.titulo;
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(text) : false);
  }
  // Una confirmación nueva sustituye a la que hubiera abierta: esa se da por
  // cancelada, nunca por aceptada.
  current?.resolve(false);
  return new Promise<boolean>((resolve) => {
    current = { ...options, resolve };
    emit();
  });
}

/** Cierra la confirmación abierta con la respuesta dada. */
export function settleConfirm(ok: boolean) {
  const pending = current;
  current = null;
  emit();
  pending?.resolve(ok);
}

export function subscribeConfirm(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentConfirm(): PendingConfirm | null {
  return current;
}
