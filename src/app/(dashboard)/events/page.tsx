import Link from "next/link";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenRostersPanel } from "@/components/events/open-rosters-panel";
import { EventsTable } from "@/components/events/events-table";
import { CalendarImportButton } from "@/components/events/calendar-import-button";
import { canCreateCompetition, canImportCalendar } from "@/lib/permissions";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

export default async function EventsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const events = [...(await dataService.getCompetitions(user))].sort((a, b) =>
    a.fecha.localeCompare(b.fecha),
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operaciones"
        title="Campeonatos"
        description={`${events.length} campeonatos en calendario · gestión de plantillas de jueces`}
      >
        <div className="flex flex-wrap gap-2">
          {canImportCalendar(user.role) && <CalendarImportButton />}
          {canCreateCompetition(user.role) && (
            <Button className="gap-1.5" asChild>
              <Link href="/events/new">
                <Plus className="h-4 w-4" />
                Nuevo campeonato
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>

      <OpenRostersPanel events={events} />

      <Card>
        <CardHeader className="border-b border-border-muted pb-4">
          <CardTitle>Todos los campeonatos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <EventsTable initialEvents={events} role={user.role} userZona={user.zona} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
