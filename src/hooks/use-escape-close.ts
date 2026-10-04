"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.offsetParent !== null,
  );
}

/**
 * Comportamiento estándar de diálogo modal del proyecto. Devuelve el ref que
 * hay que colgar del panel junto con `tabIndex={-1}`.
 *
 * - Escape cierra.
 * - Al abrir, el foco entra en el panel.
 * - El tabulador da la vuelta DENTRO del diálogo. Antes salía a los botones
 *   de la página de detrás, que seguían activos bajo el velo.
 * - Al cerrar, el foco vuelve a donde estaba (el botón que lo abrió); antes se
 *   perdía al principio de la página.
 * - La página de detrás no se desplaza mientras el diálogo está abierto.
 *
 * `active` permite usarlo en diálogos que están siempre montados y se
 * muestran con una prop `open`.
 */
export function useEscapeClose<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  active = true,
) {
  const panelRef = useRef<T>(null);
  // El callback vive en un ref para que el efecto se monte una sola vez por
  // apertura. Antes dependía de `onClose`, y los diálogos que reciben una
  // lambda del padre reenfocaban el panel en cada render del padre: el foco
  // saltaba del campo que se estaba escribiendo al contenedor.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Quién tenía el foco ANTES de abrir. Se anota durante el render de apertura
  // y no en el efecto: un campo con `autoFocus` dentro del diálogo se enfoca al
  // montar, antes de los efectos, y entonces el «anterior» era ese mismo campo
  // y al cerrar el foco caía al principio de la página.
  const openerRef = useRef<HTMLElement | null>(null);
  const wasActiveRef = useRef(false);
  if (active && !wasActiveRef.current && typeof document !== "undefined") {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasActiveRef.current = active;

  useEffect(() => {
    if (!active) return;
    const previouslyFocused = openerRef.current;
    // Si un campo con autoFocus ya tiene el foco dentro, se respeta.
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== "Tab" || !panel) return;
      const items = focusables(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement;
      if (!panel.contains(current)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (current === first || current === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [active]);
  return panelRef;
}
