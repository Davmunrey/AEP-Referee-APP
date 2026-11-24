"use client";

import { useEffect, useEffectEvent, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.offsetParent !== null,
  );
}

/**
 * Registro del foco fuera de React: el elemento que tenía el foco justo antes
 * del actual. Así se sabe quién abrió un diálogo aunque un campo con
 * `autoFocus` se haya llevado el foco al montar (antes se anotaba durante el
 * render, que React puede repetir o descartar).
 */
let lastFocused: HTMLElement | null = null;
let beforeLastFocused: HTMLElement | null = null;
let tracking = false;

function trackFocus() {
  if (tracking || typeof document === "undefined") return;
  tracking = true;
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.addEventListener(
    "focusin",
    (e) => {
      if (!(e.target instanceof HTMLElement) || e.target === lastFocused) return;
      beforeLastFocused = lastFocused;
      lastFocused = e.target;
    },
    true,
  );
}

function previousFocus(): HTMLElement | null {
  return beforeLastFocused;
}

// Se instala al cargar el módulo en el navegador, antes de que se abra ningún
// diálogo (si se instalara al montar el primero, su `autoFocus` ya habría
// pasado y no se sabría quién lo abrió).
trackFocus();

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
  // Evento de efecto: el efecto se monta una sola vez por apertura y siempre
  // llama al `onClose` actual. Antes dependía de `onClose`, y los diálogos que
  // reciben una lambda del padre reenfocaban el panel en cada render del
  // padre: el foco saltaba del campo que se estaba escribiendo al contenedor.
  const close = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!active) return;
    // Quién tenía el foco ANTES de abrir. Un campo con `autoFocus` dentro del
    // diálogo se enfoca al montar, antes de los efectos: entonces el foco
    // actual ya es ese campo y el que abrió el diálogo es el anterior.
    const current = document.activeElement;
    const previouslyFocused =
      panelRef.current && current && panelRef.current.contains(current)
        ? previousFocus()
        : current instanceof HTMLElement
          ? current
          : null;
    // Si un campo con autoFocus ya tiene el foco dentro, se respeta.
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
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
