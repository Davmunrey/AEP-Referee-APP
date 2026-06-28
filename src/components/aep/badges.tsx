import { Badge } from "@/components/ui/badge";
import { abbreviateRefereeLevel } from "@/lib/referee-level-label";
import type { EventStatus, EventType, RefereeLevel, RefereeStatus } from "@/lib/types";

export function LevelBadge({
  level,
  compact = false,
}: {
  level: RefereeLevel;
  /** Abreviatura (R, N, I, II) para la tarima; el directorio usa el nombre completo. */
  compact?: boolean;
}) {
  const variant =
    level === "Regional"
      ? "regional"
      : level === "Nacional"
        ? "nacional"
        : level === "IPF Cat. 1"
          ? "ipf1"
          : "ipf2";

  const label = compact ? abbreviateRefereeLevel(level) : level;

  return (
    <Badge
      variant={variant}
      size={compact ? "sm" : "default"}
      title={compact ? level : undefined}
      className={compact ? "min-w-[1.25rem] justify-center px-1 font-mono tabular-nums" : undefined}
    >
      {label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: RefereeStatus }) {
  const variant =
    status === "Activo"
      ? "success"
      : status === "Sancionado"
        ? "danger"
        : "muted";

  return <Badge variant={variant}>{status}</Badge>;
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const variant =
    status === "Completo"
      ? "success"
      : status === "Incompleto"
        ? "warning"
        : status === "Crítico"
          ? "danger"
          : "muted";

  return <Badge variant={variant}>{status}</Badge>;
}

export function EventTypeBadge({ tipo }: { tipo: EventType }) {
  const variant = tipo === "AEP-1" ? "danger" : tipo === "AEP-2" ? "warning" : "regional";
  return <Badge variant={variant}>{tipo}</Badge>;
}

export function ActivityTypeBadge({ tipo }: { tipo: string }) {
  const map: Record<string, "success" | "danger" | "warning" | "ipf1" | "muted"> = {
    aprobacion: "success",
    rechazo: "danger",
    propuesta: "warning",
    ascenso: "ipf1",
    cambio: "muted",
  };
  const labels: Record<string, string> = {
    aprobacion: "APROBADO",
    rechazo: "RECHAZO",
    propuesta: "PROPUESTA",
    ascenso: "ASCENSO",
    cambio: "CAMBIO",
  };
  return (
    <Badge variant={map[tipo] ?? "muted"} size="sm" className="tracking-wider">
      {labels[tipo] ?? tipo.toUpperCase()}
    </Badge>
  );
}
