"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { disclosureEnter } from "@/components/aep/motion";

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
          aria-controls={open ? "roster-help" : undefined}
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
          Cómo montar una tarima
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-(--duration-enter) ease-(--ease-out)",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </div>
      {/* Plegada se desmonta: antes quedaba en el DOM a opacidad 0 (texto
          invisible que sí leían los lectores de pantalla) y animaba
          max-height, que recalcula el layout en cada fotograma. Ahora entra
          solo con opacidad, como el resto de desplegables. */}
      {open && (
      <div id="roster-help" className={cn("mt-3 grid max-w-prose gap-2 text-xs text-muted-foreground", disclosureEnter)}>
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
        <p className="text-2xs text-subtle-muted">
          Calendario anual (varios campeonatos) se importa desde la lista de Campeonatos.
        </p>
      </div>
      )}
    </div>
  );
}
