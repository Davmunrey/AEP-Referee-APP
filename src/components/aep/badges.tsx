import { Badge } from "@/components/ui/badge";
import type { EventStatus, EventType, RefereeLevel, RefereeStatus } from "@/lib/types";

export function LevelBadge({ level }: { level: RefereeLevel }) {
  const variant =
    level === "Regional"
      ? "regional"
      : level === "Nacional"
        ? "nacional"
        : level === "IPF Cat. 1"
          ? "ipf1"
          : "ipf2";

  return <Badge variant={variant}>{level}</Badge>;
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
    <Badge variant={map[tipo] ?? "muted"} className="text-[9px] tracking-wider">
      {labels[tipo] ?? tipo.toUpperCase()}
    </Badge>
  );
}
