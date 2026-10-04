import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { zoneUiName } from "@/lib/aep-zones";
import { daysUntil } from "@/lib/dashboard-intelligence";
import type { PortalConvocatoria } from "@/lib/convocatorias";
import { cn, formatDateRange } from "@/lib/utils";

function cierreTexto(iso: string): string {
  const d = daysUntil(iso);
  if (d === null) return "";
  if (d <= 0) return "Cierra hoy";
  if (d === 1) return "Cierra mañana";
  return `Cierra en ${d} días`;
}

/** Una convocatoria abierta, en la lista del portal. */
export function ConvocatoriaCard({ item }: { item: PortalConvocatoria }) {
  const apuntadas = item.sesiones.filter((s) => s.inscrito).length;
  const urgente = (daysUntil(item.cierraEl) ?? 99) <= 2;
  return (
    <Link
      href={`/portal/convocatorias/${item.id}`}
      className="surface-card flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-surface-hover focus-ring"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-foreground">{item.competitionName}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatDateRange(item.fecha, item.fechaFin)} · {item.sede}
          {item.otraZona && item.zona ? ` · ${zoneUiName(item.zona)}` : ""}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className={cn(urgente ? "font-medium text-warning" : "text-muted-foreground")}>{cierreTexto(item.cierraEl)}</span>
          <span className="text-border" aria-hidden="true">·</span>
          <span className={apuntadas > 0 ? "font-medium text-success" : "text-muted-foreground"}>
            {apuntadas > 0
              ? `Apuntado a ${apuntadas} de ${item.sesiones.length} ${item.sesiones.length === 1 ? "sesión" : "sesiones"}`
              : `${item.sesiones.length} ${item.sesiones.length === 1 ? "sesión" : "sesiones"}`}
          </span>
          {item.otraZona && <span className="rounded bg-info-muted px-1.5 text-[11px] font-medium leading-5 text-info">Otra zona</span>}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
    </Link>
  );
}
