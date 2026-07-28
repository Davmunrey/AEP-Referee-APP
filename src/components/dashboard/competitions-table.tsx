import Link from "next/link";
import { EventStatusBadge, EventTypeBadge } from "@/components/aep/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Competition } from "@/lib/types";
import { formatDateRange } from "@/lib/utils";
import { ArrowRight, CalendarClock } from "lucide-react";

export function CompetitionsTable({ competitions }: { competitions: Competition[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted py-4">
        <CardTitle className="text-sm font-semibold">Plantillas de jueces — próximos campeonatos</CardTitle>
        <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Completitud del roster
        </span>
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
              {competitions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <CalendarClock className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium text-foreground/70">Sin competiciones próximas</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Crea un campeonato para empezar a montar su tarima.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {competitions.map((competition) => {
                const pct = competition.requeridos > 0 ? Math.round((competition.confirmados / competition.requeridos) * 100) : 0;
                return (
                  <tr
                    key={competition.id}
                    className="border-b border-border/60 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{competition.nombre}</p>
                      <p className="text-xs text-subtle-muted">{competition.sede}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                      {formatDateRange(competition.fecha, competition.fechaFin)}
                    </td>
                    <td className="px-6 py-4">
                      <EventTypeBadge tipo={competition.tipo} />
                    </td>
                    <td className="px-6 py-4 min-w-[140px]">
                      {competition.requeridos > 0 ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-2 flex-1" />
                            <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
                              {pct}%
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] tabular-nums text-subtle-muted">
                            {competition.confirmados}/{competition.requeridos} confirmados
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin plantilla</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <EventStatusBadge status={competition.estado} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/competitions/${competition.id}`}>
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
