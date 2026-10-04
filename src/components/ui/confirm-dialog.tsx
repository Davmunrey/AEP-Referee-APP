"use client";

import { useSyncExternalStore } from "react";
import { AlertTriangle } from "lucide-react";
import { dialogOverlayEnter, dialogPanelEnter } from "@/components/aep/motion";
import { Button } from "@/components/ui/button";
import { useEscapeClose } from "@/hooks/use-escape-close";
import { cn } from "@/lib/utils";

/**
 * Confirmación dentro de la aplicación, en lugar del `window.confirm` del
 * navegador.
 *
 * El diálogo nativo salía con la dirección de la web como título («localhost
 * dice…» / «aep-tarima.vercel.app dice…»), con botones «Aceptar / Cancelar»
 * que no decían qué iba a pasar, sin el estilo de la app y, en móvil, a veces
 * bloqueado por el propio navegador. Aquí el botón nombra la acción
 * («Eliminar juez») y la destructiva se pinta como tal.
 *
 * Se usa como el nativo, con `await`, desde cualquier manejador:
 *
 *   if (!(await confirmar({ titulo: "¿Eliminar este examen?", accion: "Eliminar", peligro: true }))) return;
 *
 * `<ConfirmHost />` vive una sola vez en el layout raíz.
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

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let current: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function confirmar(options: ConfirmOptions): Promise<boolean> {
  // Sin anfitrión montado (tests, o un render fuera del layout) se comporta
  // como el nativo para no dejar la acción colgada.
  if (listeners.size === 0) {
    const text = options.detalle ? `${options.titulo}\n\n${options.detalle}` : options.titulo;
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(text) : false);
  }
  current?.resolve(false);
  return new Promise<boolean>((resolve) => {
    current = { ...options, resolve };
    emit();
  });
}

function settle(ok: boolean) {
  const pending = current;
  current = null;
  emit();
  pending?.resolve(ok);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function ConfirmHost() {
  const pending = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return pending ? <ConfirmPanel key={pending.titulo} pending={pending} /> : null;
}

function ConfirmPanel({ pending }: { pending: Pending }) {
  const panelRef = useEscapeClose<HTMLDivElement>(() => settle(false));
  const peligro = Boolean(pending.peligro);
  return (
    <div
      className={cn("fixed inset-0 z-[70] flex items-end justify-center bg-overlay p-4 sm:items-center", dialogOverlayEnter)}
      onClick={() => settle(false)}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={pending.detalle ? "confirm-detail" : undefined}
        className={cn(
          "w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-md outline-none",
          dialogPanelEnter,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          {peligro ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          ) : null}
          <div className="min-w-0 space-y-1.5">
            <h2 id="confirm-title" className="text-pretty text-[15px] font-semibold leading-snug text-foreground">
              {pending.titulo}
            </h2>
            {pending.detalle ? (
              <p id="confirm-detail" className="whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground">
                {pending.detalle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => settle(false)} autoFocus={peligro}>
            {pending.cancelar ?? "Cancelar"}
          </Button>
          <Button variant={peligro ? "destructive" : "default"} onClick={() => settle(true)} autoFocus={!peligro}>
            {pending.accion ?? "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
