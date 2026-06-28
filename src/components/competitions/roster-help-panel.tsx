"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function RosterHelpPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border-muted bg-muted/30 px-4 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-foreground-secondary focus-ring"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="h-3.5 w-3.5 text-primary" aria-hidden />
          Cómo montar una tarima
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      <div
        className={cn(
          "grid gap-2 overflow-hidden text-xs text-muted-foreground transition-all",
          open ? "mt-3 max-h-48 opacity-100" : "max-h-0 opacity-0",
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
            <span className="font-mono">*</span> (compartido).
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
