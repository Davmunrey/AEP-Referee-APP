"use client";

import { useSyncExternalStore } from "react";
import { AlertTriangle } from "lucide-react";
import { dialogOverlayEnter, dialogPanelEnter } from "@/components/aep/motion";
import { Button } from "@/components/ui/button";
import { useEscapeClose } from "@/hooks/use-escape-close";
import { currentConfirm, settleConfirm, subscribeConfirm, type PendingConfirm } from "@/lib/confirm-store";
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
 * `confirmar()` vive en `lib/confirm-store.ts`; `<ConfirmHost />` se monta una
 * sola vez en el layout raíz.
 */
export { confirmar } from "@/lib/confirm-store";
export type { ConfirmOptions } from "@/lib/confirm-store";

export function ConfirmHost() {
  const pending = useSyncExternalStore(subscribeConfirm, currentConfirm, () => null);
  return pending ? <ConfirmPanel key={pending.titulo} pending={pending} /> : null;
}

function ConfirmPanel({ pending }: { pending: PendingConfirm }) {
  const panelRef = useEscapeClose<HTMLDivElement>(() => settleConfirm(false));
  const peligro = Boolean(pending.peligro);
  return (
    <div
      className={cn("fixed inset-0 z-[70] flex items-end justify-center bg-overlay p-4 sm:items-center", dialogOverlayEnter)}
      onClick={() => settleConfirm(false)}
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
          <Button variant="outline" onClick={() => settleConfirm(false)} autoFocus={peligro}>
            {pending.cancelar ?? "Cancelar"}
          </Button>
          <Button variant={peligro ? "destructive" : "default"} onClick={() => settleConfirm(true)} autoFocus={!peligro}>
            {pending.accion ?? "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
