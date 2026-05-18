"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RosterRevisionPanelProps {
  filledSlots: number;
  totalSlots: number;
  fillPct: number;
  violationCount: number;
  openSlots: number;
  onGoAssign: () => void;
}

export function RosterRevisionPanel({
  filledSlots,
  totalSlots,
  fillPct,
  violationCount,
  openSlots,
  onGoAssign,
}: RosterRevisionPanelProps) {
  const ready = fillPct >= 100 && violationCount === 0;

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <h2 className="text-sm font-semibold text-foreground">Revisión antes de enviar</h2>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          {fillPct >= 100 ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-warning" />
          )}
          <span>
            Cobertura: {filledSlots}/{totalSlots} plazas ({fillPct}%)
          </span>
        </li>
        <li className="flex items-center gap-2">
          {openSlots === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-warning" />
          )}
          <span>Huecos sin asignar: {openSlots}</span>
        </li>
        <li className="flex items-center gap-2">
          {violationCount === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
          <span>
            Violaciones de normativa: {violationCount}
          </span>
        </li>
      </ul>
      <p
        className={cn(
          "rounded-lg border px-3 py-2 text-xs",
          ready
            ? "border-success-border bg-success-subtle text-success"
            : "border-warning-border bg-warning-subtle text-warning",
        )}
      >
        {ready
          ? "La tarima cumple los requisitos mínimos. Puedes enviarla a aprobación con el botón superior."
          : "Completa la asignación y corrige violaciones antes de enviar."}
      </p>
      {!ready && (
        <Button type="button" variant="outline" size="sm" onClick={onGoAssign}>
          Volver a asignación
        </Button>
      )}
    </div>
  );
}
