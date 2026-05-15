import { notFound } from "next/navigation";
import { RosterBuilder } from "@/components/events/roster-builder";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: EventPageProps) {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const event = await dataService.getCompetition(id);
  const roster = await dataService.getRoster(id);
  if (!event || !roster) notFound();

  const meta = await dataService.getMeta(user);

  return (
    <RosterBuilder
      event={event}
      template={roster.template}
      initialAssignments={roster.assignments}
      referees={await dataService.getReferees({ user })}
      zones={meta.zones}
      levels={meta.levels}
    />
  );
}
