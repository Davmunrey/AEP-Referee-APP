"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fila de pasos + ayuda. Antes eran dos franjas (la ayuda plegable encima y
 * los pasos debajo); ahora los pasos van a la izquierda y la ayuda, a la
 * derecha, y su contenido se despliega debajo de la misma fila.
 */
export function RosterHelpPanel({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border-muted px-4 py-2 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {children}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-ring"
          aria-expanded={open}
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
          Cómo montar una tarima
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200 ease-(--ease-out)",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </div>
      <div
        className={cn(
          // `transition-all` animaba también color y sombra sin motivo. Aquí lo
          // que cambia es alto y opacidad, y nada más.
          "grid gap-2 overflow-hidden text-xs text-muted-foreground transition-[max-height,opacity,margin] duration-200 ease-(--ease-out)",
          open ? "mt-3 max-h-96 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>
            <strong className="text-foreground-secondary">Plantilla:</strong> define sesiones y
            plazas, o importa el horario PDF de este campeonato (no el calendario anual).
          </li>
          <li>
            <strong className="text-foreground-secondary">Asignación:</strong> arrastra jueces a
            los huecos; el sistema avisa si no cumplen nivel o normativa. Si un mismo juez coincide
            en dos posiciones que se solapan (p. ej. tarima + pesaje de la sesión siguiente),
            te pedirá confirmación y, al aceptar, marca el puesto con{" "}
            <span>*</span> (compartido).
          </li>
          <li>
            <strong className="text-foreground-secondary">Revisión:</strong> comprueba cobertura y
            envía a aprobación cuando esté listo.
          </li>
        </ol>
        <p className="text-[11px] text-subtle-muted">
          Calendario anual (varios campeonatos) se importa desde la lista de Campeonatos.
        </p>
      </div>
    </div>
  );
}
