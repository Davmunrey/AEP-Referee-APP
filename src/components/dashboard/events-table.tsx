import Link from "next/link";
import { EventStatusBadge, EventTypeBadge } from "@/components/aep/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Competition } from "@/lib/types";
import { formatDateRange } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export function EventsTable({ competitions }: { competitions: Competition[] }) {
  const events = competitions;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Plantillas de jueces — próximos campeonatos</CardTitle>
        <span className="text-xs text-subtle-muted">Estado de completitud del roster</span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-subtle-muted">
                <th className="px-6 py-3 font-medium">Campeonato</th>
                <th className="px-6 py-3 font-medium">Fechas</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium">Completitud</th>
                <th className="px-6 py-3 font-medium">Estado</th>
                <th className="px-6 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-xs text-subtle-muted"
                  >
                    Sin competiciones próximas.
                  </td>
                </tr>
              )}
              {events.map((event) => {
                const pct = event.requeridos > 0 ? Math.round((event.confirmados / event.requeridos) * 100) : 0;
                return (
                  <tr
                    key={event.id}
                    className="border-b border-border/60 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{event.nombre}</p>
                      <p className="text-xs text-subtle-muted">{event.sede}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {formatDateRange(event.fecha, event.fechaFin)}
                    </td>
                    <td className="px-6 py-4">
                      <EventTypeBadge tipo={event.tipo} />
                    </td>
                    <td className="px-6 py-4 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="flex-1" />
                        <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                          {pct}%
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-subtle-muted">
                        {event.confirmados}/{event.requeridos} confirmados
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <EventStatusBadge status={event.estado} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/events/${event.id}`}>
                          Gestionar
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
