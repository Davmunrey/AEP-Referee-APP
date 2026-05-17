import { notFound } from "next/navigation";
import { RosterBuilder } from "@/components/events/roster-builder";
import { canEditRoster, getSession } from "@/lib/auth/session";
import { isCompetitionPast } from "@/lib/competition-status";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: EventPageProps) {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const [event, roster, meta, regulations, referees] = await Promise.all([
    dataService.getCompetition(id),
    dataService.getRoster(id),
    dataService.getMeta(user),
    dataService.getRegulations(),
    dataService.getReferees({ user }),
  ]);
  if (!event || !roster) notFound();
  // Un delegado de zona solo accede a campeonatos de su zona.
  if (user.role === "delegado_zona" && event.zona !== user.zona) notFound();

  // Eventos pasados → modo solo lectura aunque el rol permita editar.
  const isPast = isCompetitionPast(event);
  const canEdit = canEditRoster(user, event.zona) && !isPast;

  return (
    <RosterBuilder
      event={event}
      template={roster.template}
      initialAssignments={roster.assignments}
      initialFlags={roster.flags ?? {}}
      canEdit={canEdit}
      isPast={isPast}
      referees={referees}
      zones={meta.zones}
      levels={meta.levels}
      regulations={regulations}
      userRole={user.role}
    />
  );
}
