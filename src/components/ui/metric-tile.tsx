import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Cifra resumen de una bandeja: icono, número y rótulo.
 *
 * La misma pieza estaba escrita cuatro veces —una copia local en aprobaciones,
 * otra en ascensos, otra en línea en exámenes y una variante distinta en
 * compensación—, y el `StatCard` compartido que había en `ui/` no lo usaba
 * nadie. Ahora es una sola, con el tono como dato y no como clases sueltas.
 */
export type MetricTone = "neutral" | "warning" | "success" | "danger" | "primary";

const TONOS: Record<MetricTone, { icon: string; chip: string }> = {
  neutral: { icon: "text-foreground-secondary", chip: "bg-muted" },
  warning: { icon: "text-warning", chip: "bg-warning-muted" },
  success: { icon: "text-success", chip: "bg-success-muted" },
  danger: { icon: "text-destructive", chip: "bg-destructive-muted" },
  primary: { icon: "text-primary", chip: "bg-primary-muted" },
};

interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: MetricTone;
  /** Línea secundaria bajo el rótulo («+ 405 € pendiente de km»). */
  hint?: React.ReactNode;
  className?: string;
}

export function MetricTile({ label, value, icon: Icon, tone = "neutral", hint, className }: MetricTileProps) {
  const t = TONOS[tone];
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-3 px-4 py-3.5">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", t.chip)}>
          <Icon className={cn("h-4 w-4", t.icon)} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">
            {value}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          {hint ? <p className="mt-0.5 truncate text-[11px] tabular-nums text-subtle-muted">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
