import { isCompetitionPast } from "@/lib/competition-status";
import { buildIntelligence } from "@/lib/dashboard-intelligence";
import { LEVELS } from "@/lib/mock-data";
import { applyCoverageToCompetition, rosterAnalyticsStats } from "@/lib/roster-coverage";
import { buildDashboardKpis } from "@/lib/dashboard-kpis";
import { enumerateSlotKeys, normalizeCompetitionTemplate } from "@/lib/roster-template";
import { resolveZoneCode } from "@/lib/aep-zones";
import { calendarEventsFromCompetitions } from "@/lib/calendar-from-competitions";
import type {
  AnalyticsPayload,
  AppMeta,
  Competition,
  DashboardPayload,
  RegulationRule,
  RosterSession,
  SessionUser,
} from "@/lib/types";
import { mapActivity, mapCompetition } from "@/server/db/mappers";
import { getRegulationsCached } from "@/server/cache/static-data";
import { expireStaleSanctions, getSanctionAlerts } from "@/server/services/referee-sanctions";
import {
  applyLastHealthSnapshot,
  cachedLoadAllAssignments,
  loadAssignmentsFor,
  db,
  fetchAllPagesOf,
  getZones,
  readLastHealthSnapshot,
  recordHealthSnapshot,
  yearFromIso,
} from "./supabase-helpers";
import { zoneScopeOf, zoneVisibilityFilter } from "@/lib/zone-scope";
import { afterResponse } from "@/lib/after-response";

/**
 * Campeonatos visibles para `user` con la cobertura viva aplicada, y la
 * plantilla normalizada de cada uno, de UNA sola lectura `select("*")`.
 *
 * Replica `competitionService.getCompetitions` (mismo orden fecha+id, mismo
 * paginado, mismo filtro fail-closed del delegado de zona) pero conserva la
 * plantilla, que getCompetitions calcula y descarta. Antes la analítica la
 * volvía a pedir con otra lectura entera de `competitions` solo para eso. Y
 * recibe las asignaciones ya cargadas, en vez de volver a pedirlas por su
 * cuenta: fuera de un render RSC `cache()` no deduplica nada.
 */
function loadVisibleCompetitionsWithTemplates(
  user: SessionUser | undefined,
  rows: Record<string, unknown>[],
  assignmentsByComp: Map<string, Record<string, string>>,
): { competitions: Competition[]; templateById: Map<string, RosterSession[]> } {
  const templateById = new Map<string, RosterSession[]>();
  const list = rows.map((row) => {
    const comp = mapCompetition(row);
    const template = normalizeCompetitionTemplate(
      (row.template as RosterSession[] | null) ?? null,
      comp.tipo,
    );
    templateById.set(comp.id, template);
    return applyCoverageToCompetition(comp, template, assignmentsByComp.get(comp.id) ?? {});
  });
  // Fail-closed, igual que getCompetitions: sin zona reconocible el delegado
  // no ve ningún campeonato.
  if (user?.role === "delegado_zona") {
    const userZone = resolveZoneCode(user.zona);
    if (!userZone) return { competitions: [], templateById };
    return { competitions: list.filter((c) => resolveZoneCode(c.zona) === userZone), templateById };
  }
  return { competitions: list, templateById };
}

export const analyticsService = {
  getMeta: async (user: SessionUser): Promise<AppMeta> => ({
    zones: await getZones(),
    levels: LEVELS,
    currentUser: user,
  }),

  getDashboard: async (user: SessionUser): Promise<DashboardPayload> => {
    await expireStaleSanctions();
    const supabase = db();
    const isZoneScoped = user.role === "delegado_zona" && !!user.zona;
    const userZone = isZoneScoped ? resolveZoneCode(user.zona) : undefined;
    // Un delegado de zona cuya zona NO se reconoce no es «sin restricción»:
    // con `!userZone` caía en el mismo saco que un super admin y veía el panel
    // entero. `zoneVisibilityFilter` separa los tres casos.
    const visibleEnZona = zoneVisibilityFilter(user);

    // El `.order("id")` de cada una no es cosmético: es el desempate que hace
    // determinista el paginado de más abajo. `OFFSET`/`LIMIT` sobre una lectura
    // sin orden total no garantiza nada entre página y página —Postgres puede
    // devolver las filas como le convenga—, así que una escritura concurrente,
    // o simplemente un plan distinto, hace que una fila salga dos veces y otra
    // no salga ninguna. Comprobado contra un PostgreSQL de verdad: 2500 filas
    // paginadas de mil en mil con una escritura en medio devolvieron 300
    // repetidas y se dejaron 300 sin devolver.
    //
    // Y esto es la portada: de aquí salen «jueces activos», «pendientes de
    // aprobación» y la cobertura de la temporada. Un número mal no se ve como
    // un error, se ve como un dato.
    //
    // Las demás lecturas paginadas de la aplicación ya lo llevan
    // (competitions por fecha+id, referee_reports por created_at+id,
    // approval_proposals por submitted_at+id); estas cuatro se habían quedado
    // atrás, y `referees`, `approval_proposals` y `promotion_requests` ni
    // siquiera pedían un orden.
    // Columnas ligeras (sin la plantilla JSON): el calendario y la actividad
    // necesitan todo el histórico, pero solo nombres y fechas. La plantilla y
    // las asignaciones se piden después, y solo de los campeonatos vigentes.
    let competitionQuery = supabase
      .from("competitions")
      .select("id, nombre, tipo, fecha, fecha_fin, sede, sesiones, requeridos, confirmados, estado, aprobacion, zona")
      .order("fecha", { ascending: true })
      .order("id", { ascending: true });
    let refereeQuery = supabase
      .from("referees")
      .select("estado, disp, zona")
      .order("id", { ascending: true });
    // Solo las pendientes: el panel no usa de estas dos tablas más que el
    // recuento de `status === "pendiente"` (inteligencia y KPIs), y leer el
    // histórico entero era transferir filas para tirarlas.
    const approvalQuery = supabase
      .from("approval_proposals")
      .select("status, zona")
      .eq("status", "pendiente")
      .order("id", { ascending: true });
    const promotionQuery = supabase
      .from("promotion_requests")
      .select("status, zona")
      .eq("status", "pendiente")
      .order("id", { ascending: true });

    if (userZone) {
      // competitions.zona y referees.zona son FK a códigos canónicos: `.eq` es
      // seguro. approval_proposals.zona y promotion_requests.zona son texto
      // libre (filas anteriores a la migración 013 conservan códigos legados
      // como "MAD" o "Centro"), así que se filtran en memoria canonicalizando.
      competitionQuery = competitionQuery.eq("zona", userZone);
      refereeQuery = refereeQuery.eq("zona", userZone);
    }

    // Todas paginadas y con el error a la vista: el panel es la portada, y una
    // pantalla de ceros —«sin campeonatos», «cobertura 0 %», «nada pendiente»—
    // es una afirmación sobre la temporada, no un hueco. El registro de
    // actividad sí lleva su propio `limit(20)` y no necesita paginarse.
    // La última captura de salud y las alertas de sanción no dependen de nada
    // de lo demás: van en esta misma tanda en vez de en una etapa final aparte.
    // Las alertas siguen dentro del `await`, así que su error sigue tumbando
    // el panel igual que antes.
    const [
      competitionRows,
      { data: activity, error: activityError },
      referees,
      approvals,
      promotions,
      lastHealth,
      sanctionAlerts,
    ] = await Promise.all([
      fetchAllPagesOf<Record<string, unknown>>("competitions", (from, to) =>
        competitionQuery.range(from, to),
      ),
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20),
      fetchAllPagesOf<{ estado: string; disp?: boolean; zona?: unknown }>("referees", (from, to) =>
        refereeQuery.range(from, to),
      ),
      fetchAllPagesOf<{ status: string; zona?: unknown }>("approval_proposals", (from, to) =>
        approvalQuery.range(from, to),
      ),
      fetchAllPagesOf<{ status: string; zona?: unknown }>("promotion_requests", (from, to) =>
        promotionQuery.range(from, to),
      ),
      readLastHealthSnapshot(),
      getSanctionAlerts(user, { skipExpire: true }),
    ]);
    if (activityError) throw new Error(`activity_log: ${activityError.message}`);

    // El `.eq("zona")` de la consulta solo se aplica cuando la zona del
    // delegado se reconoce. Con la zona vacía o ilegible no había filtro y el
    // delegado veía en el calendario, los KPIs y la cobertura los campeonatos
    // de toda España (el twin en memoria sí filtraba). Fail-closed aquí.
    const competitions = (competitionRows ?? [])
      .map((r) => mapCompetition(r as Record<string, unknown>))
      .filter((c) => visibleEnZona(c.zona));
    // El dashboard es operativo: solo campeonatos no celebrados. Sin filtro,
    // eventos de temporadas pasadas inflaban KPIs, salud e insights para
    // siempre y encabezaban la tabla de "próximos". El calendario sí conserva
    // el histórico completo.
    const dashboardCompetitions = competitions.filter((c) => !isCompetitionPast(c));
    const dashboardIds = new Set(dashboardCompetitions.map((c) => c.id));
    const competitionNames = new Set(competitions.map((c) => c.nombre));
    const dashboardIdList = [...dashboardIds];
    const [templateRows, assignmentsByComp] = await Promise.all([
      dashboardIdList.length === 0
        ? Promise.resolve([] as { id: string; template: RosterSession[] | null; tipo: string }[])
        : fetchAllPagesOf<{ id: string; template: RosterSession[] | null; tipo: string }>(
            "competitions",
            (from, to) =>
              supabase
                .from("competitions")
                .select("id, template, tipo")
                .in("id", dashboardIdList)
                .order("id", { ascending: true })
                .range(from, to),
          ),
      loadAssignmentsFor(dashboardIdList),
    ]);
    const templateByComp = new Map(
      templateRows.map((row) => [
        String(row.id),
        normalizeCompetitionTemplate(row.template, row.tipo as Competition["tipo"]),
      ] as const),
    );
    // Cobertura VIVA de cada campeonato vigente: plantilla + asignaciones, con
    // la misma fórmula que la tarima y la analítica. `confirmados`, `requeridos`
    // y `estado` guardados en la fila son una copia que puede ir atrasada (un
    // campeonato importado y nunca tocado), y antes la tabla del panel la
    // enseñaba («5/9») al lado de la previsión calculada («15/45»).
    const liveById = new Map(
      dashboardCompetitions.map((c) => [
        c.id,
        applyCoverageToCompetition(c, templateByComp.get(c.id) ?? [], assignmentsByComp.get(c.id) ?? {}),
      ] as const),
    );
    const liveCompetitions = dashboardCompetitions.map((c) => liveById.get(c.id) ?? c);
    const coverage = liveCompetitions.map((c) => {
      const s = rosterAnalyticsStats(templateByComp.get(c.id) ?? [], assignmentsByComp.get(c.id) ?? {}, c.requeridos);
      return { id: c.id, nombre: c.nombre, fecha: c.fecha, estado: c.estado, filled: s.filledSlots, open: s.openSlots, required: s.requiredSlots };
    });
    const activityItems = (activity ?? [])
      .map((r) => mapActivity(r as Record<string, unknown>))
      .filter((item) => zoneScopeOf(user).kind === "all" || competitionNames.has(item.evento));
    const scopedReferees = ((referees ?? []) as { estado: string; disp?: boolean; zona?: unknown }[]).filter(
      (r) => visibleEnZona(String(r.zona ?? "")),
    );
    const inUserZone = (r: { zona?: unknown }) => visibleEnZona(String(r.zona ?? ""));
    const scopedApprovals = ((approvals ?? []) as { status: string; zona?: unknown }[]).filter(
      inUserZone,
    );
    const scopedPromotions = ((promotions ?? []) as { status: string; zona?: unknown }[]).filter(
      inUserZone,
    );
    const { health, insights } = buildIntelligence({
      referees: scopedReferees,
      competitions: liveCompetitions,
      approvals: scopedApprovals,
      promotions: scopedPromotions,
      coverage,
      activity: activityItems,
    });

    // Histórico de salud: el delta se calcula ya con la captura leída arriba;
    // registrar la nueva (cada seis horas) no cambia nada de esta respuesta,
    // así que se hace al terminarla en vez de hacer esperar a la portada. Si
    // la lectura falló (tabla ausente), se degrada como antes: sin delta y
    // sin registrar.
    if (lastHealth && applyLastHealthSnapshot(health, lastHealth.last)) {
      afterResponse(() => recordHealthSnapshot(health));
    }
    const kpis = buildDashboardKpis({ coverage, referees: scopedReferees, approvals: scopedApprovals });

    return {
      kpis,
      activity: activityItems,
      calendar: calendarEventsFromCompetitions(competitions.map((c) => liveById.get(c.id) ?? c)),
      upcomingCompetitions: liveCompetitions.slice(0, 6),
      currentUser: user,
      health,
      insights,
      coverage,
      sanctionAlerts,
      generatedAt: new Date().toISOString(),
    };
  },

  getAnalytics: async (user?: SessionUser, requestedYear?: number): Promise<AnalyticsPayload> =>
    (await analyticsService.getAnalyticsWithCompetitions(user, requestedYear)).analytics,

  /** La analítica y la lista de campeonatos visibles de una sola carga. La
   * exportación CSV necesita las dos y, en un route handler, `cache()` no
   * deduplica: pedirlas por separado recorría roster_assignments entero tres
   * veces y `competitions` dos. */
  getAnalyticsWithCompetitions: async (
    user?: SessionUser,
    requestedYear?: number,
  ): Promise<{ analytics: AnalyticsPayload; competitions: Competition[] }> => {
    const userZone =
      user?.role === "delegado_zona" && user.zona ? resolveZoneCode(user.zona) : undefined;
    // Ver `zone-scope`: una zona ilegible no es «sin restricción».
    const visibleEnZonaExport = zoneVisibilityFilter(user);
    const supabase = db();
    // Lecturas independientes en paralelo (antes eran ~6 awaits en serie en la
    // página más pesada), incluido el cruce cross-zona, que antes esperaba al
    // año seleccionado en una etapa aparte.
    // Paginadas y sin tragarse el error, igual que el panel: la analítica se usa
    // para decidir, y una serie histórica incompleta miente igual que una vacía.
    const [
      competitionRows,
      assignmentsByComp,
      crossZoneRows,
      referees,
      zones,
      approvals,
    ] = await Promise.all([
      // Mismo orden que getCompetitions (fecha y, de desempate, id).
      fetchAllPagesOf<Record<string, unknown>>("competitions", (from, to) =>
        supabase.from("competitions").select("*").order("fecha").order("id").range(from, to),
      ),
      cachedLoadAllAssignments(),
      // Solo las plazas cubiertas desde otra zona, de todas las temporadas: son
      // pocas, y los recuentos de abajo ya se limitan a los campeonatos del año
      // seleccionado y visibles para el usuario, así que las demás no cuentan.
      // Antes se releían TODAS las filas del año (en serie, en trozos) para
      // quedarse con estas en memoria. `cross_zone` es BOOLEAN NOT NULL
      // (migración 017): `.eq(true)` equivale al `=== true` de antes. El orden
      // es la clave primaria: total, para que el paginado no repita ni salte.
      fetchAllPagesOf<{ competition_id: unknown }>("roster_assignments", (from, to) =>
        supabase
          .from("roster_assignments")
          .select("competition_id")
          .eq("cross_zone", true)
          .order("competition_id", { ascending: true })
          .order("slot_key", { ascending: true })
          .range(from, to),
      ),
      fetchAllPagesOf<Record<string, unknown>>("referees", (from, to) =>
        supabase
          .from("referees")
          .select("id, nombre, nivel, zona, estado")
          .order("id", { ascending: true })
          .range(from, to),
      ),
      getZones(),
      // Sin `.eq("zona")`: la columna es texto libre con códigos anteriores a la
      // migración 013, que no normalizó esta tabla. Se filtra abajo en memoria.
      fetchAllPagesOf<Record<string, unknown>>("approval_proposals", (from, to) =>
        supabase
          .from("approval_proposals")
          .select("status, submitted_at, zona")
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);
    const { competitions, templateById } = loadVisibleCompetitionsWithTemplates(
      user,
      competitionRows,
      assignmentsByComp,
    );
    const years = Array.from(
      new Set(competitions.map((c) => yearFromIso(c.fecha)).filter((y): y is number => y != null)),
    ).sort((a, b) => a - b);
    // Año seleccionable por el usuario (query ?year=); si no es válido o no tiene
    // datos, cae al año natural más reciente con actividad.
    const selectedYear =
      requestedYear != null && years.includes(requestedYear)
        ? requestedYear
        : years[years.length - 1] ?? new Date().getFullYear();
    const yearAgg = new Map<number, { competitions: number; criticalCompetitions: number; requiredSlots: number; filledSlots: number; refereeIds: Set<string> }>();
    const zoneAgg = new Map<string, { competitions: number; criticalCompetitions: number; requiredSlots: number; filledSlots: number; refereeIds: Set<string> }>();
    const topRefAgg = new Map<string, { competitionIds: Set<string>; slots: number }>();

    for (const c of competitions) {
      const year = yearFromIso(c.fecha);
      if (year == null) continue;
      const tpl = templateById.get(c.id) ?? [];
      const assignments = assignmentsByComp.get(c.id) ?? {};
      const stats = rosterAnalyticsStats(tpl, assignments, c.requeridos);
      const y = yearAgg.get(year) ?? { competitions: 0, criticalCompetitions: 0, requiredSlots: 0, filledSlots: 0, refereeIds: new Set<string>() };
      y.competitions += 1;
      y.criticalCompetitions += c.estado === "Crítico" ? 1 : 0;
      y.requiredSlots += stats.requiredSlots;
      y.filledSlots += stats.filledSlots;
      stats.refereeIds.forEach((id) => y.refereeIds.add(id));
      yearAgg.set(year, y);
      const zoneCode = c.zona ? resolveZoneCode(c.zona) : undefined;
      if (year === selectedYear && zoneCode) {
        const z = zoneAgg.get(zoneCode) ?? { competitions: 0, criticalCompetitions: 0, requiredSlots: 0, filledSlots: 0, refereeIds: new Set<string>() };
        z.competitions += 1;
        z.criticalCompetitions += c.estado === "Crítico" ? 1 : 0;
        z.requiredSlots += stats.requiredSlots;
        z.filledSlots += stats.filledSlots;
        stats.refereeIds.forEach((id) => z.refereeIds.add(id));
        zoneAgg.set(zoneCode, z);
      }
      if (year === selectedYear) {
        const validKeys = new Set(enumerateSlotKeys(tpl));
        for (const [slotKey, refereeId] of Object.entries(assignments)) {
          if (!refereeId || !validKeys.has(slotKey)) continue;
          const refAgg = topRefAgg.get(refereeId) ?? { competitionIds: new Set<string>(), slots: 0 };
          refAgg.competitionIds.add(c.id);
          refAgg.slots += 1;
          topRefAgg.set(refereeId, refAgg);
        }
      }
    }
    const mappedReferees = (referees ?? []).map((r) => ({
      id: String((r as Record<string, unknown>).id),
      nombre: String((r as Record<string, unknown>).nombre),
      nivel: String((r as Record<string, unknown>).nivel),
      zona: String((r as Record<string, unknown>).zona),
      estado: String((r as Record<string, unknown>).estado),
    }));
    const scopedReferees = userZone || zoneScopeOf(user).kind === "unresolved"
      ? mappedReferees.filter((r) => visibleEnZonaExport(r.zona))
      : mappedReferees;
    const activityByZone = zones.map((z) => {
      const agg = zoneAgg.get(z.code);
      const activeReferees = scopedReferees.filter(
        (r) => resolveZoneCode(r.zona) === z.code && r.estado === "Activo",
      ).length;
      return { zona: z.code, name: z.name, competitions: agg?.competitions ?? 0, criticalCompetitions: agg?.criticalCompetitions ?? 0, requiredSlots: agg?.requiredSlots ?? 0, filledSlots: agg?.filledSlots ?? 0, uniqueAssignedReferees: agg?.refereeIds.size ?? 0, activeReferees };
    });
    const topReferees = [...topRefAgg.entries()]
      .map(([id, agg]) => {
        const referee = scopedReferees.find((r) => r.id === id);
        if (!referee) return null;
        return { id, nombre: referee.nombre, nivel: referee.nivel, assignedCompetitions: agg.competitionIds.size, assignedSlots: agg.slots };
      })
      .filter(Boolean)
      .sort((a, b) => (b!.assignedCompetitions - a!.assignedCompetitions) || (b!.assignedSlots - a!.assignedSlots) || a!.nombre.localeCompare(b!.nombre, "es"))
      .slice(0, 5) as AnalyticsPayload["topReferees"];
    const approvalsForYear = ((approvals ?? []) as { status: string; submitted_at?: unknown; zona?: unknown }[])
      .filter((a) => visibleEnZonaExport(String(a.zona ?? "")))
      .filter((a) => yearFromIso(String(a.submitted_at ?? "")) === selectedYear);
    const reviewed = approvalsForYear.filter((a) => a.status !== "pendiente").length;
    const rejected = approvalsForYear.filter((a) => a.status === "rechazado").length;
    const rejectionRate = reviewed > 0 ? Math.round((rejected / reviewed) * 100) : null;
    const yearlyHistory = [...yearAgg.entries()].sort((a, b) => a[0] - b[0]).map(([year, agg]) => ({ year, competitions: agg.competitions, criticalCompetitions: agg.criticalCompetitions, requiredSlots: agg.requiredSlots, filledSlots: agg.filledSlots, uniqueAssignedReferees: agg.refereeIds.size }));
    const selectedYearAgg = yearAgg.get(selectedYear);
    // Paginado (ver arriba): el cruce cross-zona se leía con un `.in()` suelto,
    // así que un año con muchos campeonatos perdía asignaciones y el mapa de
    // cruces salía corto.
    const crossZoneByComp = new Map<string, number>();
    for (const row of crossZoneRows) {
      const id = String(row.competition_id);
      crossZoneByComp.set(id, (crossZoneByComp.get(id) ?? 0) + 1);
    }
    const crossZoneByZone = new Map<string, number>();
    for (const c of competitions) {
      if (yearFromIso(c.fecha) !== selectedYear || !c.zona) continue;
      const zoneCode = resolveZoneCode(c.zona);
      if (!zoneCode) continue;
      const count = crossZoneByComp.get(c.id) ?? 0;
      if (count > 0) crossZoneByZone.set(zoneCode, (crossZoneByZone.get(zoneCode) ?? 0) + count);
    }
    // Total sobre TODAS las competiciones del año (incluidas las sin zona
    // resoluble): antes el numerador las excluía y el denominador no.
    let totalCrossZoneSlots = 0;
    for (const c of competitions) {
      if (yearFromIso(c.fecha) !== selectedYear) continue;
      totalCrossZoneSlots += crossZoneByComp.get(c.id) ?? 0;
    }
    const filledForYear = selectedYearAgg?.filledSlots ?? 0;
    const analytics: AnalyticsPayload = {
      availableYears: years,
      selectedYear,
      yearlyHistory,
      activityByZone: activityByZone.map((z) => ({ ...z, crossZoneSlots: crossZoneByZone.get(z.zona) ?? 0 })),
      topReferees,
      rejectionRate,
      criticalEvents: competitions.filter((c) => c.estado === "Crítico" && yearFromIso(c.fecha) === selectedYear),
      crossZoneSummary: { totalCrossZoneSlots, pctOfFilledSlots: filledForYear > 0 ? Math.round((totalCrossZoneSlots / filledForYear) * 100) : 0 },
      totals: {
        competitions: selectedYearAgg?.competitions ?? 0,
        criticalCompetitions: selectedYearAgg?.criticalCompetitions ?? 0,
        activeReferees: scopedReferees.filter((r) => r.estado === "Activo").length,
        totalReferees: scopedReferees.length,
        pendingApprovals: approvalsForYear.filter((a) => a.status === "pendiente").length,
        uniqueAssignedReferees: selectedYearAgg?.refereeIds.size ?? 0,
        filledSlots: selectedYearAgg?.filledSlots ?? 0,
        openSlots: selectedYearAgg ? Math.max(0, selectedYearAgg.requiredSlots - selectedYearAgg.filledSlots) : 0,
      },
    };
    return { analytics, competitions };
  },

  getRegulations: async (): Promise<RegulationRule[]> => getRegulationsCached(),
};
