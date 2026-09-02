"use client";

import { useEffect, useRef } from "react";

/**
 * Comportamiento estándar de modal del proyecto: cierra con Escape y enfoca el
 * panel al abrir (para que el foco de teclado entre en el diálogo). Devuelve el
 * ref que hay que colgar del panel junto con `tabIndex={-1}`.
 */
export function useEscapeClose<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const panelRef = useRef<T>(null);
  // El callback vive en un ref para que el efecto se monte una sola vez. Antes
  // dependía de `onClose`, y los diálogos que reciben una lambda del padre
  // (`onClose={() => setOpen(false)}`) reenfocaban el panel en cada render del
  // padre: el foco saltaba del campo que se estaba escribiendo al contenedor.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handler);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, []);
  return panelRef;
}
