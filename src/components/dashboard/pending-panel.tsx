import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ZoneRequestActions } from "@/components/dashboard/zone-request-actions";
import { zoneUiName } from "@/lib/aep-zones";
import type { SolicitudDeZona } from "@/lib/convocatorias";
import type { Insight, InsightSeverity, SanctionAlert } from "@/lib/types";
import { contar } from "@/lib/plural";
import { cn, formatDateRange } from "@/lib/utils";

const marker: Record<InsightSeverity, string> = {
  crítico: "bg-destructive",
  alerta: "bg-warning",
  sugerencia: "bg-info",
  ok: "bg-success",
};

const rowClass =
  "group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/**
 * Lo que hay que hacer, en una lista. Sustituye a «Recomendaciones» (icono de
 * destellos, insignias de métrica y bordes de color por severidad) y a la
 * tarjeta suelta de «Sanciones activas»: el color queda en un punto.
 */
export function PendingPanel({
  insights,
  sanctions,
  solicitudes = [],
}: {
  insights: Insight[];
  sanctions: SanctionAlert[];
  /** Convocatorias de otras zonas que piden jueces de la tuya. */
  solicitudes?: SolicitudDeZona[];
}) {
  const todo = insights.filter((i) => i.severity !== "ok");
  const total = todo.length + sanctions.length + solicitudes.length;

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border-muted px-4 py-3">
        <CardTitle>Pendiente</CardTitle>
        {total > 0 && <span className="text-xs tabular-nums text-muted-foreground">{total}</span>}
      </CardHeader>
      {total === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nada pendiente. Todo al día.</p>
      ) : (
        <ul className="divide-y divide-border-muted">
          {solicitudes.map((s) => (
            <li key={`${s.convocatoriaId}:${s.zona}`} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-info" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {s.competitionName} pide jueces de {zoneUiName(s.zona)}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {s.competitionZona ? `${zoneUiName(s.competitionZona)} · ` : ""}
                  {formatDateRange(s.fecha, s.fecha)}
                  {s.origen === "automatica" ? " · faltan inscritos" : ""}. Si aceptas, tus jueces podrán apuntarse hasta el{" "}
                  {formatDateRange(s.cierraEl, s.cierraEl)}.
                </p>
                <ZoneRequestActions convocatoriaId={s.convocatoriaId} zona={s.zona} />
              </div>
            </li>
          ))}
          {todo.map((i) => {
            const body = (
              <>
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", marker[i.severity])} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{i.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{i.detail}</p>
                </div>
                {i.action && (
                  <ChevronRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-subtle transition-colors group-hover:text-foreground"
                    aria-hidden="true"
                  />
                )}
              </>
            );
            return (
              <li key={i.id}>
                {i.action ? (
                  <Link href={i.action.href} className={rowClass} aria-label={`${i.title}: ${i.action.label}`}>
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3">{body}</div>
                )}
              </li>
            );
          })}
          {sanctions.map((a) => (
            <li key={a.id}>
              <Link href={`/referees/${a.refereeId}`} className={rowClass}>
                <span
                  className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", a.kind === "por_vencer" ? "bg-warning" : "bg-subtle")}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{a.refereeName}: sanción activa</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.zonaName} · hasta el {formatDateRange(a.fechaFin, a.fechaFin)}
                    {a.kind === "por_vencer" && ` · vence en ${contar(a.daysLeft, "día", "días")}`}
                  </p>
                </div>
                <ChevronRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-subtle transition-colors group-hover:text-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
