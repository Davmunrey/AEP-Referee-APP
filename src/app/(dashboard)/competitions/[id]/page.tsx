import { notFound, redirect } from "next/navigation";
import { RosterBuilder } from "@/components/competitions/roster-builder";
import { canEditRoster, getSession } from "@/lib/auth/session";
import { isCompetitionPast } from "@/lib/competition-status";
import { dataService } from "@/server/services";

interface CompetitionPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const competitionPre = await dataService.getCompetition(id);
  const [competition, roster, meta, regulations, referees] = await Promise.all([
    Promise.resolve(competitionPre),
    dataService.getRoster(id),
    dataService.getMeta(user),
    dataService.getRegulations(),
    dataService.getReferees({ forDate: competitionPre?.fecha }),
  ]);
  if (!competition || !roster) notFound();
  if (user.role === "delegado_zona" && competition.zona !== user.zona) notFound();

  const isPast = isCompetitionPast(competition);
  const canEdit = canEditRoster(user, competition.zona);

  return (
    <RosterBuilder
      competition={competition}
      template={roster.template}
      initialAssignments={roster.assignments}
      initialFlags={roster.flags ?? {}}
      initialCrossZoneMap={roster.crossZoneMap ?? {}}
      canEdit={canEdit}
      isPast={isPast}
      referees={referees}
      zones={meta.zones}
      levels={meta.levels}
      regulations={regulations}
      defaultZonaFilter={
        user.role === "delegado_zona" && competition.zona
          ? competition.zona
          : "TODAS"
      }
    />
  );
}
