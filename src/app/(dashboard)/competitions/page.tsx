import Link from "next/link";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenRostersPanel } from "@/components/competitions/open-rosters-panel";
import { CompetitionsTable } from "@/components/competitions/competitions-table";
import { CalendarImportButton } from "@/components/competitions/calendar-import-button";
import { canCreateCompetition, canImportCalendar } from "@/lib/permissions";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

export default async function CompetitionsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const competitions = [...(await dataService.getCompetitions(user))].sort((a, b) =>
    a.fecha.localeCompare(b.fecha),
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operaciones"
        title="Campeonatos"
        description={`${competitions.length} campeonatos en calendario · gestión de plantillas de jueces`}
      >
        <div className="flex flex-wrap gap-2">
          {canImportCalendar(user.role) && <CalendarImportButton />}
          {canCreateCompetition(user.role) && (
            <Button className="gap-1.5" asChild>
              <Link href="/competitions/new">
                <Plus className="h-4 w-4" />
                Nuevo campeonato
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>

      <OpenRostersPanel competitions={competitions} />

      <Card>
        <CardHeader className="border-b border-border-muted pb-4">
          <CardTitle>Todos los campeonatos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <CompetitionsTable initialEvents={competitions} role={user.role} userZona={user.zona} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
