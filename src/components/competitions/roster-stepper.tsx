"use client";

import type { RosterWorkflowStep } from "@/lib/roster-ui";
import { ROSTER_STEP_LABELS } from "@/lib/roster-ui";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS: RosterWorkflowStep[] = ["plantilla", "asignacion", "revision"];

interface RosterStepperProps {
  current: RosterWorkflowStep;
  onChange: (step: RosterWorkflowStep) => void;
  disabled?: boolean;
  plantillaDone?: boolean;
  asignacionDone?: boolean;
}

export function RosterStepper({
  current,
  onChange,
  disabled = false,
  plantillaDone = false,
  asignacionDone = false,
}: RosterStepperProps) {
  const doneFor = (step: RosterWorkflowStep) => {
    if (step === "plantilla") return plantillaDone;
    if (step === "asignacion") return asignacionDone;
    return plantillaDone && asignacionDone;
  };

  return (
    <nav
      className="flex flex-wrap items-center gap-1 rounded-lg bg-surface p-0.5"
      aria-label="Pasos del constructor de tarima"
    >
      {STEPS.map((step, i) => {
        const isCurrent = step === current;
        // Un paso solo cuenta como hecho si lo está de verdad, no por haber
        // pasado por delante (ir a «Revisión» no completa la plantilla).
        const done = doneFor(step);
        return (
          <div key={step} className="flex items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(step)}
              className={cn(
                // Pestañas segmentadas: el paso actual es la pestaña elevada.
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-ring",
                isCurrent && "bg-card text-foreground shadow-sm ring-1 ring-border",
                !isCurrent && done && "text-success hover:bg-surface-hover",
                !isCurrent && !done && "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                disabled && "pointer-events-none opacity-50",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-semibold",
                  isCurrent && "bg-primary text-primary-foreground",
                  !isCurrent && done && "bg-success text-primary-foreground",
                  !isCurrent && !done && "bg-muted text-muted-foreground",
                )}
              >
                {done && !isCurrent ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {ROSTER_STEP_LABELS[step]}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
