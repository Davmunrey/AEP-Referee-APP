import { notFound, redirect } from "next/navigation";
import { zonesMatch } from "@/lib/aep-zones";
import { RosterBuilder } from "@/components/competitions/roster-builder";
import { canEditRoster, canManageCompensation, getSession } from "@/lib/auth/session";
import { SIGN_IN_SIN_ACCESO } from "@/lib/auth/sign-in-redirect";
import { isCompetitionPast } from "@/lib/competition-status";
import { stripRefereeListPII } from "@/lib/referee-pii";
import { dataService } from "@/server/services";

interface CompetitionPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const user = await getSession();
  if (!user) redirect(SIGN_IN_SIN_ACCESO);

  const { id } = await params;
  const [
    competition,
    roster,
    meta,
    regulations,
    referees,
    confirmedRefereeIds,
    refereeBusyMap,
    lastApproval,
    paidRefereeIds,
  ] =
    await Promise.all([
      dataService.getCompetition(id),
      dataService.getRoster(id),
      dataService.getMeta(user),
      dataService.getRegulations(),
      dataService.getReferees(),
      dataService.getCompetitionAvailability(id),
      dataService.getRefereeBusyMap(id),
      dataService.getLatestApproval(id),
      dataService.getPaidClaimRefereeIds(id),
    ]);
  if (!competition || !roster) notFound();
  // Mismo criterio canónico que `assertCompetitionInUserZone` en la API: sin
   // esto la página podía dar 404 sobre una competición que la API sí permitía.
  if (user.role === "delegado_zona" && !zonesMatch(competition.zona, user.zona)) notFound();

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
      canManageCompensation={canManageCompensation(user)}
      isPast={isPast}
      referees={stripRefereeListPII(referees, user)}
      zones={meta.zones}
      levels={meta.levels}
      regulations={regulations}
      initialConfirmedIds={confirmedRefereeIds}
      refereeBusyMap={refereeBusyMap}
      paidRefereeIds={paidRefereeIds}
      lastReview={
        lastApproval && {
          status: lastApproval.status,
          comment: lastApproval.comment,
          reviewedBy: lastApproval.reviewedBy,
          reviewedAt: lastApproval.reviewedAt,
        }
      }
      defaultZonaFilter={
        user.role === "delegado_zona" && competition.zona
          ? competition.zona
          : "TODAS"
      }
    />
  );
}
