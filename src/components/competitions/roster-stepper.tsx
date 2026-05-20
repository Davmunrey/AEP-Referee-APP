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

  const idx = STEPS.indexOf(current);

  return (
    <nav
      className="flex flex-wrap items-center gap-1 border-b border-border-muted bg-surface/50 px-4 py-2"
      aria-label="Pasos del constructor de tarima"
    >
      {STEPS.map((step, i) => {
        const isCurrent = step === current;
        const isPast = i < idx;
        const done = doneFor(step) || isPast;
        return (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && (
              <span
                className={cn(
                  "mx-1 hidden h-px w-5 sm:block",
                  isPast || done ? "bg-primary/40" : "bg-border",
                )}
                aria-hidden
              />
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(step)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-ring",
                isCurrent && "border-primary bg-primary/10 text-primary",
                !isCurrent && done && "border-success-border bg-success-subtle text-success",
                !isCurrent && !done && "border-border bg-surface text-muted-foreground hover:border-border-strong",
                disabled && "pointer-events-none opacity-50",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold",
                  isCurrent && "bg-primary text-primary-foreground",
                  !isCurrent && done && "bg-success text-success-foreground",
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
