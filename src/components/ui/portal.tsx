"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/use-is-client";

/**
 * Lleva los diálogos a `<body>`.
 *
 * Un overlay `position: fixed` se recoloca respecto al primer antecesor con
 * `transform`, `filter` o `backdrop-filter`, no respecto a la ventana: el
 * diálogo de contraseña ya se recortó dentro de la barra lateral por eso, y
 * cualquier contenedor con una animación de entrada (`rise-in` deja un
 * `translateY(0)`) produce lo mismo. Fuera del árbol, ningún antecesor lo
 * condiciona.
 *
 * Se monta en el MISMO render en el cliente (`useIsClient`), no un
 * tick después con `useEffect`: `useEscapeClose` mueve el foco al panel en su
 * efecto, y el panel tiene que existir ya para entonces. En el servidor y
 * durante la hidratación no pinta nada.
 */
export function Portal({ children }: { children: ReactNode }) {
  const enCliente = useIsClient();
  return enCliente ? createPortal(children, document.body) : null;
}
