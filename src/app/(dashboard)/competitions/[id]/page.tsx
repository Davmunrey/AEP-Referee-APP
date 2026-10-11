import { notFound } from "next/navigation";
import { zonesMatch } from "@/lib/aep-zones";
import { RosterBuilder } from "@/components/competitions/roster-builder";
import { RosterQuadrantSourceProvider } from "@/components/competitions/roster-quadrant-source";
import { CompetitionCrumbSeed } from "@/components/layout/competition-crumb-label";
import { canEditRoster, canManageCompensation, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { isCompetitionPast } from "@/lib/competition-status";
import { stripRefereeListPII } from "@/lib/referee-pii";
import { dataService } from "@/server/services";
import { getConvocatoriaDeCampeonato } from "@/server/convocatorias";

interface CompetitionPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const { id } = await params;
  const [
    competitionWithRoster,
    meta,
    regulations,
    referees,
    confirmedRefereeIds,
    refereeBusyMap,
    lastApproval,
    paidRefereeIds,
    convocatoria,
    respuestas,
  ] =
    await Promise.all([
      // Una sola lectura de la fila y de las asignaciones (antes, tres de cada).
      dataService.getCompetitionWithRoster(id),
      dataService.getMeta(user),
      dataService.getRegulations(),
      dataService.getReferees(),
      dataService.getCompetitionAvailability(id),
      dataService.getRefereeBusyMap(id),
      dataService.getLatestApproval(id),
      dataService.getPaidClaimRefereeIds(id),
      getConvocatoriaDeCampeonato(id),
      dataService.getDesignacionRespuestas(id),
    ]);
  if (!competitionWithRoster) notFound();
  const { competition, roster } = competitionWithRoster;
  // Mismo criterio canónico que `assertCompetitionInUserZone` en la API: sin
   // esto la página podía dar 404 sobre una competición que la API sí permitía.
  if (user.role === "delegado_zona" && !zonesMatch(competition.zona, user.zona)) notFound();

  const isPast = isCompetitionPast(competition);
  const canEdit = canEditRoster(user, competition.zona);
  const flags = roster.flags ?? {};
  // Solo los campos que lee el árbol de la tarima (ficha, filtros, reglas,
  // convocatoria y disponibilidad). El censo entero viajaba con teléfonos,
  // domicilios, notas y las estadísticas año a año de cada juez de España, y
  // se volvía a serializar en cada `router.refresh()` de la tarima. `ultimo`
  // se queda para que la proyección siga siendo un `Referee` completo.
  const rosterReferees = stripRefereeListPII(referees, user).map(
    ({ id, nombre, zona, nivel, estado, eventos, ultimo, disp, iniciales, arbitrajeStats }) => ({
      id,
      nombre,
      zona,
      nivel,
      estado,
      eventos,
      ultimo,
      disp,
      iniciales,
      arbitrajeStats,
    }),
  );

  // Los mismos objetos van a RosterBuilder y al proveedor del cuadrante: React
  // los serializa una sola vez y el segundo uso viaja como referencia.
  return (
    <RosterQuadrantSourceProvider
      competition={competition}
      template={roster.template}
      assignments={roster.assignments}
      flags={flags}
      referees={rosterReferees}
    >
      <CompetitionCrumbSeed id={competition.id} nombre={competition.nombre} />
      <RosterBuilder
        competition={competition}
        template={roster.template}
        initialAssignments={roster.assignments}
        initialFlags={flags}
        initialCrossZoneMap={roster.crossZoneMap ?? {}}
        canEdit={canEdit}
        canManageCompensation={canManageCompensation(user)}
        isPast={isPast}
        referees={rosterReferees}
        zones={meta.zones}
        levels={meta.levels}
        regulations={regulations}
        initialConfirmedIds={confirmedRefereeIds}
        refereeBusyMap={refereeBusyMap}
        paidRefereeIds={paidRefereeIds}
        initialConvocatoria={convocatoria}
        respuestas={respuestas}
        isNationalUser={user.role === "super_admin" || user.role === "delegado_jueces"}
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
    </RosterQuadrantSourceProvider>
  );
}
