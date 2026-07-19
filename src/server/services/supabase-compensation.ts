// Submódulos concretos en vez del barrel: el índice re-exporta receipt-pdf
// (→ pdfkit), que se cargaba en el cold start de TODAS las rutas API vía el
// grafo de dataService aunque solo la ruta de export lo usa.
import { buildCompensationClaim } from "@/lib/judge-compensation/calculate";
import {
  fetchDrivingDistanceKm,
  geocodeAddress,
  osmThrottle,
} from "@/lib/judge-compensation/osm-distance";
import { applyCompensationClaimPatch } from "@/lib/judge-compensation/claim-patch";
import type { CompensationHubSummary } from "@/lib/judge-compensation/hub-types";
import { buildHubSummary } from "@/lib/judge-compensation/hub";
import type {
  CompensationClaim,
  CompensationClaimStatus,
  CompensationTravelMode,
  CompetitionCompensationSummary,
} from "@/lib/judge-compensation/types";
import { normalizeCompetitionTemplate } from "@/lib/roster-template";
import type { Competition, Referee, RosterSession, SessionUser } from "@/lib/types";
import {
  claimToDbRow,
  mapCompensationClaimRow,
  mapCompensationDutyLine,
} from "@/server/db/mappers";
import {
  buildClaimInputFromRoster,
  summarizeCompensation,
} from "./compensation-helpers";
import { competitionService } from "./supabase-competitions";
import { refereeService } from "./supabase-referees";
import { rosterService } from "./supabase-roster";
import {
  cachedLoadAllAssignments,
  db,
  getCompetitionTemplate,
  hasCompensationOverrideColumn,
  hasRefereeDomicilioGeoColumns,
  loadRosterAssignmentData,
} from "./supabase-helpers";

function claimId(competitionId: string, refereeId: string): string {
  return `cmp-${competitionId}-${refereeId}`;
}

function dutyLineId(claimIdValue: string, index: number): string {
  return `${claimIdValue}-dl-${index}`;
}

async function loadDutyLinesByClaim(
  claimIds: string[],
): Promise<Map<string, ReturnType<typeof mapCompensationDutyLine>[]>> {
  const map = new Map<string, ReturnType<typeof mapCompensationDutyLine>[]>();
  if (claimIds.length === 0) return map;
  const supabase = db();
  const { data } = await supabase
    .from("judge_compensation_duty_lines")
    .select("*")
    .in("claim_id", claimIds);
  for (const row of data ?? []) {
    const cid = String((row as Record<string, unknown>).claim_id);
    const lines = map.get(cid) ?? [];
    lines.push(mapCompensationDutyLine(row as Record<string, unknown>));
    map.set(cid, lines);
  }
  return map;
}

async function loadStoredClaims(
  competitionId: string,
  competition: Competition,
): Promise<Map<string, CompensationClaim>> {
  const supabase = db();
  const { data } = await supabase
    .from("judge_compensation_claims")
    .select("*")
    .eq("competition_id", competitionId);
  const rows = data ?? [];
  const dutyMap = await loadDutyLinesByClaim(rows.map((r) => String((r as Record<string, unknown>).id)));
  const result = new Map<string, CompensationClaim>();
  for (const row of rows) {
    const rec = row as Record<string, unknown>;
    const id = String(rec.id);
    const claim = mapCompensationClaimRow(rec, dutyMap.get(id) ?? [], competition);
    result.set(String(rec.referee_id), claim);
  }
  return result;
}

function assignedRefereeIds(assignments: Record<string, string>): string[] {
  return [...new Set(Object.values(assignments).filter(Boolean))];
}

function mergeClaimFromRoster(input: {
  competition: Competition;
  referee: Referee;
  template: import("@/lib/types").RosterSession[];
  assignments: Record<string, string>;
  existing?: CompensationClaim;
}): CompensationClaim {
  const id = input.existing?.id ?? claimId(input.competition.id, input.referee.id);
  const claimInput = buildClaimInputFromRoster({
    competition: input.competition,
    referee: input.referee,
    template: input.template,
    assignments: input.assignments,
    existing: input.existing,
  });
  return buildCompensationClaim(id, claimInput, {
    submittedAt: input.existing?.submittedAt,
    reviewedAt: input.existing?.reviewedAt,
    reviewedBy: input.existing?.reviewedBy,
  });
}

async function persistClaim(claim: CompensationClaim, options?: { syncDutyLines?: boolean }): Promise<void> {
  const supabase = db();
  const row = claimToDbRow(claim);
  // claimToDbRow es síncrona y no puede sondar el esquema; la columna de override
  // (migración 034) se añade aquí solo si existe, para no romper el upsert cuando
  // la migración aún no está aplicada.
  if (await hasCompensationOverrideColumn()) {
    row.travel_amount_override = claim.travelAmountOverride ?? null;
  }
  const { error } = await supabase.from("judge_compensation_claims").upsert(row);
  if (error) throw new Error(error.message);

  if (options?.syncDutyLines === false) return;

  await supabase.from("judge_compensation_duty_lines").delete().eq("claim_id", claim.id);
  if (claim.dutyLines.length > 0) {
    const lines = claim.dutyLines.map((line, index) => ({
      id: dutyLineId(claim.id, index),
      claim_id: claim.id,
      duty_type: line.dutyType,
      session_label: line.session,
      role_key: line.roleKey ?? null,
      role_label: line.roleLabel ?? null,
      unit_amount: line.unitAmount,
      quantity: line.quantity,
      amount: line.amount,
      slot_keys: line.slotKeys,
    }));
    const { error: lineError } = await supabase.from("judge_compensation_duty_lines").insert(lines);
    if (lineError) throw new Error(lineError.message);
  }
}

async function loadMergedClaimForReferee(
  competitionId: string,
  refereeId: string,
): Promise<CompensationClaim | undefined> {
  const competition = await competitionService.getCompetition(competitionId);
  if (!competition) return undefined;

  const roster = await rosterService.getRoster(competitionId, competitionService.getCompetition);
  if (!roster || !assignedRefereeIds(roster.assignments).includes(refereeId)) return undefined;

  const id = claimId(competitionId, refereeId);
  const supabase = db();
  const [referee, claimRow] = await Promise.all([
    refereeService.getReferee(refereeId),
    supabase.from("judge_compensation_claims").select("*").eq("id", id).maybeSingle(),
  ]);
  if (!referee) return undefined;

  let existing: CompensationClaim | undefined;
  if (claimRow.data) {
    const dutyMap = await loadDutyLinesByClaim([id]);
    existing = mapCompensationClaimRow(
      claimRow.data as Record<string, unknown>,
      dutyMap.get(id) ?? [],
      competition,
    );
  }

  return mergeClaimFromRoster({
    competition,
    referee,
    template: roster.template,
    assignments: roster.assignments,
    existing,
  });
}

async function loadStoredClaimsBatch(
  competitions: Competition[],
): Promise<Map<string, Map<string, CompensationClaim>>> {
  const byComp = new Map<string, Map<string, CompensationClaim>>();
  if (competitions.length === 0) return byComp;

  const compIds = competitions.map((c) => c.id);
  const compById = new Map(competitions.map((c) => [c.id, c]));
  const supabase = db();
  const { data: claimRows } = await supabase
    .from("judge_compensation_claims")
    .select("*")
    .in("competition_id", compIds);

  const claimIds = (claimRows ?? []).map((r) => String((r as Record<string, unknown>).id));
  const dutyMap = await loadDutyLinesByClaim(claimIds);

  for (const row of claimRows ?? []) {
    const rec = row as Record<string, unknown>;
    const compId = String(rec.competition_id);
    const comp = compById.get(compId);
    if (!comp) continue;
    const id = String(rec.id);
    const claim = mapCompensationClaimRow(rec, dutyMap.get(id) ?? [], comp);
    const bucket = byComp.get(compId) ?? new Map<string, CompensationClaim>();
    bucket.set(String(rec.referee_id), claim);
    byComp.set(compId, bucket);
  }
  return byComp;
}

async function loadTemplatesBatch(compIds: string[]): Promise<Map<string, RosterSession[]>> {
  const map = new Map<string, RosterSession[]>();
  if (compIds.length === 0) return map;

  const supabase = db();
  const { data } = await supabase.from("competitions").select("id, template, tipo").in("id", compIds);
  for (const row of data ?? []) {
    const r = row as { id: string; template: RosterSession[] | null; tipo: string };
    map.set(
      r.id,
      normalizeCompetitionTemplate(r.template, r.tipo as Competition["tipo"]),
    );
  }
  return map;
}

function buildSummaryInMemory(
  competition: Competition,
  template: RosterSession[],
  assignments: Record<string, string>,
  stored: Map<string, CompensationClaim>,
  refereesById: Map<string, Referee>,
): CompetitionCompensationSummary {
  const refereeIds = assignedRefereeIds(assignments);
  if (refereeIds.length === 0) return emptySummary(competition.id);

  const claims: CompensationClaim[] = [];
  for (const refereeId of refereeIds) {
    const referee = refereesById.get(refereeId);
    if (!referee) continue;
    claims.push(
      mergeClaimFromRoster({
        competition,
        referee,
        template,
        assignments,
        existing: stored.get(refereeId),
      }),
    );
  }
  return summarizeCompensation(competition, claims, refereesById);
}

async function buildSummary(competitionId: string): Promise<CompetitionCompensationSummary> {
  const competition = await competitionService.getCompetition(competitionId);
  if (!competition) return emptySummary(competitionId);

  const [template, { assignments }] = await Promise.all([
    getCompetitionTemplate(competitionId),
    loadRosterAssignmentData(competitionId),
  ]);
  const tpl = template ?? [];
  const refereeIds = assignedRefereeIds(assignments);
  if (refereeIds.length === 0) return emptySummary(competitionId);

  const [stored, refereesById] = await Promise.all([
    loadStoredClaims(competitionId, competition),
    refereeService.getRefereesByIds(refereeIds),
  ]);
  return buildSummaryInMemory(competition, tpl, assignments, stored, refereesById);
}

function emptySummary(competitionId: string): CompetitionCompensationSummary {
  return {
    competitionId,
    claims: [],
    grandTotal: 0,
    provisionalTotal: 0,
    readiness: {
      venueReady: false,
      allTravelResolved: true,
      pendingTravelReferees: [],
      missingDomicilioReferees: [],
      issues: [],
      readyForExport: false,
    },
  };
}

export const compensationService = {
  getSummary: buildSummary,

  recalculate: async (competitionId: string): Promise<CompetitionCompensationSummary> => {
    const competition = await competitionService.getCompetition(competitionId);
    if (!competition) return emptySummary(competitionId);

    const roster = await rosterService.getRoster(competitionId, competitionService.getCompetition);
    if (!roster) return emptySummary(competitionId);
    const refereeIds = assignedRefereeIds(roster.assignments);
    const [stored, refereesById] = await Promise.all([
      loadStoredClaims(competitionId, competition),
      refereeService.getRefereesByIds(refereeIds),
    ]);
    const claims: CompensationClaim[] = [];

    for (const refereeId of refereeIds) {
      const referee = refereesById.get(refereeId);
      if (!referee) continue;
      const existing = stored.get(refereeId);
      const claim = mergeClaimFromRoster({
        competition,
        referee,
        template: roster.template,
        assignments: roster.assignments,
        existing: existing
          ? { ...existing, status: existing.status === "pagado" ? "pagado" : "borrador" }
          : undefined,
      });
      await persistClaim(claim);
      claims.push(claim);
    }

    const activeIds = new Set(claims.map((c) => c.refereeId));
    const supabase = db();
    for (const [refereeId, storedClaim] of stored) {
      if (!activeIds.has(refereeId)) {
        await supabase.from("judge_compensation_claims").delete().eq("id", storedClaim.id);
      }
    }

    return summarizeCompensation(competition, claims, refereesById);
  },

  updateClaim: async (
    competitionId: string,
    refereeId: string,
    patch: Partial<{
      travelMode: CompensationTravelMode;
      distanceKmOneWay: number | null;
      distanceKmRoundTrip: number | null;
      distanceSource: "osm" | "google_maps" | "manual" | null;
      travelAmountOverride: number | null;
      travelApproved: boolean;
      travelNotes: string | null;
      isCompetitionManager: boolean;
      competitionManagerPerDay: boolean;
      isComputerSetup: boolean;
      computerSetupAmount: number | null;
      lodgingEligibleOverride: boolean | null;
      lodgingDaysOverride: number | null;
      status: CompensationClaimStatus;
      reviewComment: string | null;
    }>,
  ): Promise<CompensationClaim | undefined> => {
    const existing = await loadMergedClaimForReferee(competitionId, refereeId);
    if (!existing) return undefined;

    const claim = applyCompensationClaimPatch(existing, patch);
    await persistClaim(claim, { syncDutyLines: false });
    return claim;
  },

  calculateDistance: async (
    competitionId: string,
    refereeId: string,
  ): Promise<CompensationClaim | undefined> => {
    const competition = await competitionService.getCompetition(competitionId);
    const referee = await refereeService.getReferee(refereeId);
    if (!competition || !referee) return undefined;

    const origin = {
      address: referee.domicilio,
      lat: referee.domicilioLat,
      lng: referee.domicilioLng,
    };
    const destination = {
      address: competition.sedeDireccion ?? competition.sede,
      lat: competition.sedeLat,
      lng: competition.sedeLng,
    };

    if (origin.lat == null || origin.lng == null) {
      if (!referee.domicilio?.trim()) return undefined;
      const geo = await geocodeAddress(referee.domicilio);
      origin.lat = geo.lat;
      origin.lng = geo.lng;
      await osmThrottle();
      // Persistir la geocodificación (best-effort) para no repetir Nominatim en
      // cada recálculo. Solo si la migración 034 añadió las columnas; un fallo del
      // UPDATE no debe romper el cálculo de distancia.
      if (origin.lat != null && origin.lng != null && (await hasRefereeDomicilioGeoColumns())) {
        try {
          await db()
            .from("referees")
            .update({ domicilio_lat: origin.lat, domicilio_lng: origin.lng })
            .eq("id", referee.id);
        } catch {
          /* best-effort: la caché de coordenadas es opcional */
        }
      }
    }
    if (destination.lat == null || destination.lng == null) {
      const addr = competition.sedeDireccion ?? competition.sede;
      if (!addr?.trim()) return undefined;
      const geo = await geocodeAddress(addr);
      destination.lat = geo.lat;
      destination.lng = geo.lng;
      await osmThrottle();
      // sede_lat / sede_lng ya existen desde la migración 024, sin sonda. Best-effort:
      // cachear la geocodificación de la sede para futuros recálculos.
      if (destination.lat != null && destination.lng != null) {
        try {
          await db()
            .from("competitions")
            .update({ sede_lat: destination.lat, sede_lng: destination.lng })
            .eq("id", competition.id);
        } catch {
          /* best-effort */
        }
      }
    }

    const result = await fetchDrivingDistanceKm(origin, destination);

    return compensationService.updateClaim(competitionId, refereeId, {
      distanceKmOneWay: result.distanceKmOneWay,
      distanceKmRoundTrip: result.distanceKmRoundTrip,
      distanceSource: "osm",
      travelMode: "km_rate",
    });
  },

  calculateAllDistances: async (competitionId: string): Promise<CompetitionCompensationSummary> => {
    const summary = await buildSummary(competitionId);
    for (const claim of summary.claims) {
      if (claim.travelMode === "shared_vehicle_passenger" || claim.travelMode === "none") continue;
      await compensationService.calculateDistance(competitionId, claim.refereeId);
      await osmThrottle(300);
    }
    return buildSummary(competitionId);
  },

  getHub: async (user: SessionUser): Promise<CompensationHubSummary> => {
    const [competitions, assignmentsByComp] = await Promise.all([
      competitionService.getCompetitions(user),
      cachedLoadAllAssignments(),
    ]);
    const compIds = competitions.map((c) => c.id);
    const [templatesById, storedByComp] = await Promise.all([
      loadTemplatesBatch(compIds),
      loadStoredClaimsBatch(competitions),
    ]);

    const allRefereeIds = new Set<string>();
    for (const comp of competitions) {
      for (const rid of Object.values(assignmentsByComp.get(comp.id) ?? {})) {
        if (rid) allRefereeIds.add(rid);
      }
    }
    const refereesById = await refereeService.getRefereesByIds([...allRefereeIds]);

    const summaries = new Map<string, CompetitionCompensationSummary>();
    for (const comp of competitions) {
      summaries.set(
        comp.id,
        buildSummaryInMemory(
          comp,
          templatesById.get(comp.id) ?? [],
          assignmentsByComp.get(comp.id) ?? {},
          storedByComp.get(comp.id) ?? new Map(),
          refereesById,
        ),
      );
    }
    return buildHubSummary(competitions, summaries);
  },

  getClaimForExport: async (
    competitionId: string,
    refereeId: string,
  ): Promise<CompensationClaim | undefined> => loadMergedClaimForReferee(competitionId, refereeId),
};
