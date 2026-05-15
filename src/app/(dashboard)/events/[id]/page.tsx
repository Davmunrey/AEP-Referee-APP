import { notFound } from "next/navigation";
import { RosterBuilder } from "@/components/events/roster-builder";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { getLevels, getZones } from "@/server/store";
import { redirect } from "next/navigation";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: EventPageProps) {
  const user = await getSession();
  if (!user) redirect("/login");

  const { id } = await params;
  const event = dataService.getCompetition(id);
  const roster = dataService.getRoster(id);
  if (!event || !roster) notFound();

  return (
    <RosterBuilder
      event={event}
      template={roster.template}
      initialAssignments={roster.assignments}
      referees={dataService.getReferees({ user })}
      zones={getZones()}
      levels={getLevels()}
    />
  );
}
