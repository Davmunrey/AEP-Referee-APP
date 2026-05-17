"use client";

import { TRANSFER_STEP_LABELS, type TransferStep } from "@/lib/import-export-ui";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const ORDER: TransferStep[] = ["upload", "preview", "result"];

export function TransferStepper({
  step,
  className,
}: {
  step: TransferStep;
  className?: string;
}) {
  const idx = ORDER.indexOf(step);
  return (
    <nav aria-label="Pasos de importación" className={cn("mb-4", className)}>
      <ol className="flex flex-wrap items-center gap-2 text-xs font-medium">
        {ORDER.map((s, i) => {
          const done = i < idx;
          const active = s === step;
          return (
            <li key={s} className="flex items-center gap-2">
              {i > 0 ? <span className="text-border-muted" aria-hidden="true">→</span> : null}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                  active && "bg-primary-soft text-primary",
                  done && !active && "bg-success-muted text-success",
                  !active && !done && "bg-surface text-subtle-muted",
                )}
              >
                {done && !active ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                {TRANSFER_STEP_LABELS[s]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
