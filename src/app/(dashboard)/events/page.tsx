import Link from "next/link";
import { EventStatusBadge, EventTypeBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderRow,
  DataTableHeadCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { formatDateRange } from "@/lib/utils";
import { ArrowRight, Plus } from "lucide-react";
import { redirect } from "next/navigation";

export default async function EventsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const events = [...dataService.getCompetitions(user)].sort((a, b) =>
    a.fecha.localeCompare(b.fecha),
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operaciones"
        title="Campeonatos"
        description={`${events.length} eventos en temporada · gestión de plantillas arbitrales`}
      >
        {user.role !== "lectura" && (
          <Button className="gap-1.5" asChild>
            <Link href="/events/new">
              <Plus className="h-4 w-4" />
              Nuevo campeonato
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader className="border-b border-border-muted pb-4">
          <CardTitle>Todos los campeonatos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable>
            <DataTableHead>
              <DataTableHeaderRow>
                <DataTableHeadCell>Campeonato</DataTableHeadCell>
                <DataTableHeadCell>Fecha</DataTableHeadCell>
                <DataTableHeadCell>Tipo</DataTableHeadCell>
                <DataTableHeadCell>Cobertura</DataTableHeadCell>
                <DataTableHeadCell>Estado</DataTableHeadCell>
                <DataTableHeadCell />
              </DataTableHeaderRow>
            </DataTableHead>
            <DataTableBody>
              {events.map((event) => {
                const pct = Math.round((event.confirmados / event.requeridos) * 100);
                return (
                  <DataTableRow key={event.id}>
                    <DataTableCell>
                      <p className="font-medium text-foreground">{event.nombre}</p>
                      <p className="text-xs text-subtle-muted">{event.sede}</p>
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs text-muted-foreground">
                      {formatDateRange(event.fecha, event.fechaFin)}
                    </DataTableCell>
                    <DataTableCell>
                      <EventTypeBadge tipo={event.tipo} />
                    </DataTableCell>
                    <DataTableCell className="min-w-[140px]">
                      <Progress value={pct} />
                      <p className="mt-1 text-[11px] text-subtle-muted">
                        {event.confirmados}/{event.requeridos} · {pct}%
                      </p>
                    </DataTableCell>
                    <DataTableCell>
                      <EventStatusBadge status={event.estado} />
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/events/${event.id}`}>
                          Tarima
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </CardContent>
      </Card>
    </PageShell>
  );
}
