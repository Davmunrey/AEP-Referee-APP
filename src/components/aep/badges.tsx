import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { abbreviateRefereeLevel } from "@/lib/referee-level-label";
import type { EventStatus, EventType, RefereeLevel, RefereeStatus } from "@/lib/types";

/**
 * Nivel y tipo de campeonato son categorías, no estados: antes «Nacional» y
 * «AEP-1» salían en rojo (el acento de la marca y el color de peligro), «IPF
 * Cat. 2» y «AEP-2» en ámbar (aviso) y «Regional» y «AEP-3» en azul (info), y
 * una ficha normal parecía tener tres alertas. Ahora son una familia neutra
 * en la que el rango se lee por intensidad: contorno → relleno suave →
 * relleno oscuro → relleno pleno. Los colores de estado quedan libres para
 * el estado (Activo, Sancionado, Incompleto…), que es lo que tiene que saltar
 * a la vista. Con tokens de primer plano y fondo, el escalón se invierte solo
 * en modo oscuro y conserva el contraste.
 */
const RANK_CLASS = [
  "bg-transparent text-muted-foreground ring-1 ring-inset ring-border-strong",
  "bg-surface-active text-foreground",
  "bg-foreground-secondary text-background",
  "bg-foreground text-background",
] as const;

const LEVEL_RANK: Record<RefereeLevel, number> = {
  Regional: 0,
  Nacional: 1,
  "IPF Cat. 2": 2,
  "IPF Cat. 1": 3,
};

const EVENT_TYPE_RANK: Record<EventType, number> = {
  "AEP-3": 0,
  "AEP-2": 1,
  "AEP-1": 3,
};

export function LevelBadge({
  level,
  compact = false,
}: {
  level: RefereeLevel;
  /** Abreviatura (R, N, I, II) para la tarima; el directorio usa el nombre completo. */
  compact?: boolean;
}) {
  const label = compact ? abbreviateRefereeLevel(level) : level;

  return (
    <Badge
      variant="secondary"
      size={compact ? "sm" : "default"}
      title={compact ? level : undefined}
      className={cn(
        RANK_CLASS[LEVEL_RANK[level] ?? 0],
        // 11 px es el suelo de la casa; el tamaño «sm» compartido baja de ahí.
        compact && "min-w-[1.25rem] justify-center px-1 text-[11px] tabular-nums",
      )}
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
  // Tres categorías, de AEP-3 a AEP-1 (la que lleva Jurado): la de más rango
  // toma el relleno pleno, como IPF Cat. 1 en los niveles.
  return (
    <Badge variant="secondary" className={cn("tabular-nums", RANK_CLASS[EVENT_TYPE_RANK[tipo] ?? 0])}>
      {tipo}
    </Badge>
  );
}

export function ActivityTypeBadge({ tipo }: { tipo: string }) {
  // Aprobación, rechazo y propuesta sí son estados de una tarima; ascenso y
  // cambio son movimientos sin más, en neutro (antes el ascenso iba en el
  // rojo del acento, como si fuera la acción principal de la pantalla).
  const map: Record<string, "success" | "danger" | "warning" | "muted"> = {
    aprobacion: "success",
    rechazo: "danger",
    propuesta: "warning",
    ascenso: "muted",
    cambio: "muted",
  };
  const labels: Record<string, string> = {
    aprobacion: "Aprobado",
    rechazo: "Rechazo",
    propuesta: "Propuesta",
    ascenso: "Ascenso",
    cambio: "Cambio",
  };
  return (
    <Badge variant={map[tipo] ?? "muted"} size="sm" className="text-[11px]">
      {labels[tipo] ?? tipo}
    </Badge>
  );
}
