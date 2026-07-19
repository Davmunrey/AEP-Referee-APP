"use client";

import { useEffect, useRef } from "react";

/**
 * Comportamiento estándar de modal del proyecto: cierra con Escape y enfoca el
 * panel al abrir (para que el foco de teclado entre en el diálogo). Devuelve el
 * ref que hay que colgar del panel junto con `tabIndex={-1}`.
 */
export function useEscapeClose<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const panelRef = useRef<T>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  return panelRef;
}
