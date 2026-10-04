import type { EventStatus } from "@/lib/types";
import { STATUS_BAR } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

/**
 * Barra de cobertura de un campeonato, coloreada por su estado (la misma regla
 * que el panel de inicio). Sustituye al `Progress` genérico, que la pintaba
 * siempre en el rojo de marca: una tarima completa parecía un problema.
 */
export function CoverageBar({
  pct,
  estado,
  label,
  className,
}: {
  pct: number;
  estado: EventStatus;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-active", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <div className={cn("h-full rounded-full", STATUS_BAR[estado])} style={{ width: `${pct}%` }} />
    </div>
  );
}
