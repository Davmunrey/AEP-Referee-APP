import { resolveZoneCode } from "@/lib/aep-zones";
import {
  isRosterLockedByApproval,
  isRosterPendingApproval,
  ROSTER_IMPREVISTO_STATE,
} from "@/lib/roster-coverage";
import type { ApprovalProposal, Competition, SessionUser } from "@/lib/types";
import { ApprovalReviewError, UserFacingServiceError } from "@/lib/competitions/service-types";
import { assignmentsFromJsonb, mapApproval } from "@/server/db/mappers";
import {
  db,
  fetchAllPagesOf,
  hasApprovalCompetitionColumns,
  loadPaidClaimRefereeIds,
  hasApprovalSubmitterColumns,
  loadAssignments,
  pushActivity,
  pushHistory,
} from "./supabase-helpers";

import { markCompetitionReviewed, startRead } from "./supabase-roster-shared";

/** Tarima: borrador, envío a aprobación, revisión del Comité, imprevistos y liquidaciones pagadas. Se compone en `rosterService` (supabase-roster.ts). */
export const rosterAprobacionService = {
  submitRoster: async (
    competitionId: string,
    actor: string,
    userId: string | undefined,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
  ) => {
    // Campeonato, tarima y las dos sondas de columnas son independientes: en
    // paralelo en vez de cuatro esperas en serie. La tarima solo se «mira»
    // después de saber que el campeonato existe, como antes.
    const readAssignments = startRead(loadAssignments(competitionId));
    const [comp, hasCompetitionColumns, hasSubmitterColumns] = await Promise.all([
      getCompetitionFn(competitionId),
      hasApprovalCompetitionColumns(),
      hasApprovalSubmitterColumns(),
    ]);
    if (!comp) return undefined;
    const assignments = await readAssignments();
    const supabase = db();
    const competitionIdColumn = hasCompetitionColumns ? "competition_id" : "event_id";
    const competitionNameColumn = hasCompetitionColumns ? "competition_name" : "event_name";
    const submitterId = hasSubmitterColumns ? { submitted_by_id: userId ?? null } : {};
    const { data: existing, error: existingError } = await supabase
      .from("approval_proposals")
      .select("*")
      .eq(competitionIdColumn, competitionId)
      .eq("status", "pendiente")
      .maybeSingle();
    // Esta lectura decide entre actualizar la propuesta pendiente o crear una
    // nueva. Si falla y se lee como «no hay ninguna», se inserta una SEGUNDA
    // propuesta pendiente del mismo campeonato: el revisor decide sobre una y
    // la otra se queda ahí, viva.
    if (existingError) {
      throw new UserFacingServiceError(
        "No se pudo comprobar si ya había una propuesta pendiente. No se ha enviado nada; vuelve a intentarlo.",
        409,
      );
    }

    const now = new Date().toISOString();
    if (existing) {
      const { error: updateError } = await supabase
        .from("approval_proposals")
        .update({ assignments, submitted_at: now, submitted_by: actor, ...submitterId })
        .eq("id", existing.id);
      // `return undefined` acababa en «No se pudo enviar la propuesta» con un
      // 500 y sin una línea en el log: ni quien envía sabe qué pasó ni queda
      // rastro para averiguarlo. La lectura de aquí al lado ya lo hacía bien.
      if (updateError) {
        console.error("[roster.submit.actualizar]", competitionId, updateError.message);
        throw new UserFacingServiceError(
          "No se pudo actualizar la propuesta pendiente. No se ha enviado nada; vuelve a intentarlo.",
          409,
        );
      }
    } else {
      const { error: insertError } = await supabase.from("approval_proposals").insert({
        // randomUUID: dos submits en el mismo milisegundo colisionaban en PK.
        id: `apr-${crypto.randomUUID()}`,
        [competitionIdColumn]: competitionId,
        [competitionNameColumn]: comp.nombre,
        zona: comp.zona ?? "—",
        submitted_by: actor,
        ...submitterId,
        submitted_at: now,
        status: "pendiente",
        assignments,
      });
      // Si el insert falla no marcamos la competición como "Propuesta enviada":
      // dejaríamos un estado enviado sin propuesta real que aprobar. Pero el
      // motivo no puede perderse por el camino, y uno de ellos tiene nombre: la
      // migración 034 creó `approval_proposals_one_pending`, un índice único
      // parcial sobre `competition_id WHERE status = 'pendiente'`. Dos envíos a
      // la vez —dos delegados, o un doble clic— chocan ahí con 23505, y eso no
      // es «no se pudo»: es que la propuesta ya está enviada.
      if (insertError) {
        if (insertError.code === "23505") {
          throw new UserFacingServiceError(
            "Otro usuario acaba de enviar la propuesta de este campeonato. Recarga la tarima para verla.",
            409,
          );
        }
        console.error("[roster.submit.crear]", competitionId, insertError.message);
        throw new UserFacingServiceError(
          "No se pudo crear la propuesta. No se ha enviado nada; vuelve a intentarlo.",
          409,
        );
      }
    }
    const { error: stateError } = await supabase
      .from("competitions")
      .update({ aprobacion: "Propuesta enviada" })
      .eq("id", competitionId);
    // La propuesta ya está creada: si la competición no queda marcada, la
    // tarima seguiría editable con una propuesta pendiente encima. Reintentar
    // es seguro (el submit reutiliza la propuesta pendiente que ya existe).
    if (stateError) throw new Error(`competitions.aprobacion: ${stateError.message}`);
    // Actividad, acta y relectura de la propuesta van juntas: las dos primeras
    // nunca lanzan y la tercera ya va después de escribir. Siguen terminando
    // antes de responder (no en after()): quien recarga el historial justo
    // después tiene que ver el envío.
    const [, , { data, error: readError }] = await Promise.all([
      pushActivity({
        tipo: "propuesta",
        actor,
        accion: "envió propuesta de roster para",
        evento: comp.nombre,
        hace: "ahora",
      }),
      // El historial de la tarima registraba cada asignación suelta pero ninguno
      // de los tres hitos del ciclo de aprobación: quien lo abría veía el trabajo
      // y no la decisión.
      pushHistory({
        competitionId,
        at: now,
        actor,
        action: "Propuesta enviada a aprobación",
        detail: `${Object.values(assignments).filter(Boolean).length} asignaciones`,
      }),
      Promise.resolve(
        supabase
          .from("approval_proposals")
          .select("*")
          .eq(competitionIdColumn, competitionId)
          .eq("status", "pendiente")
          .single(),
      ),
    ]);
    // La propuesta YA está creada y la competición marcada. Devolver `undefined`
    // hacía que la ruta contestara «No se pudo enviar la propuesta»: quien
    // enviaba la tarima creía que no había pasado nada.
    if (readError && (readError as { code?: string }).code !== "PGRST116") {
      // El motivo escrito para quien envía la tarima tiene que llegarle: como
      // `Error` a secas salía como un 500 genérico y este texto moría en el
      // log. Y el mensaje de Postgres se queda ahí, no viaja al navegador.
      console.error("[roster.submitProposal.releer]", competitionId, readError.message);
      throw new UserFacingServiceError(
        "La propuesta se envió, pero no se pudo releer. Recarga la pantalla.",
        409,
      );
    }
    return data ? mapApproval(data as Record<string, unknown>) : undefined;
  },

  saveDraft: async (
    competitionId: string,
    actor: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
  ) => {
    const comp = await getCompetitionFn(competitionId);
    // El cambio de estado y el acta no dependen uno de otro y ninguno lanza:
    // en paralelo, un round-trip menos.
    const markIncomplete = async () => {
      if (comp?.estado !== "Borrador") return;
      const supabase = db();
      const { error } = await supabase
        .from("competitions")
        .update({ estado: "Incompleto" })
        .eq("id", competitionId);
      // No se lanza —guardar el borrador es dejar constancia, y la tarima ya
      // está guardada por otro camino—, pero tampoco se calla: el listado
      // seguiría diciendo «Borrador» de una tarima con gente dentro y no había
      // forma de saber por qué. Mismo criterio que syncCompetitionCoverage.
      if (error) console.error("[roster.saveDraft.estado]", competitionId, error.message);
    };
    await Promise.all([
      markIncomplete(),
      pushHistory({
        competitionId,
        at: new Date().toISOString(),
        actor,
        action: "Guardó borrador",
      }),
    ]);
  },

  /**
   * Última propuesta de una competición, para poder enseñar en la tarima el
   * motivo del rechazo: el revisor está obligado a escribirlo, pero no llegaba
   * a la pantalla de quien tiene que corregir la tarima.
   */
  /** Jueces con la liquidación pagada, para congelar su puesto también en la UI. */
  getPaidClaimRefereeIds: async (competitionId: string): Promise<string[]> => [
    ...(await loadPaidClaimRefereeIds(competitionId)),
  ],

  getLatestApproval: async (competitionId: string): Promise<ApprovalProposal | undefined> => {
    const supabase = db();
    const column = (await hasApprovalCompetitionColumns()) ? "competition_id" : "event_id";
    const { data, error } = await supabase
      .from("approval_proposals")
      .select("*")
      .eq(column, competitionId)
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);
    if (error) throw new Error(`approval_proposals: ${error.message}`);
    const row = (data ?? [])[0];
    return row ? mapApproval(row as Record<string, unknown>) : undefined;
  },

  getApprovals: async (user?: SessionUser): Promise<ApprovalProposal[]> => {
    const supabase = db();
    // Paginado: el filtro por zona no puede ir en SQL (columna de texto libre),
    // así que sin paginar el corte en 1000 filas escondía propuestas pendientes
    // de la bandeja.
    const data = await fetchAllPagesOf<Record<string, unknown>>(
      "approval_proposals",
      (from, to) =>
        supabase
          .from("approval_proposals")
          .select("*")
          .order("submitted_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
    );
    const list = data.map((r) => mapApproval(r));
    // `zona` es texto libre y las propuestas anteriores a la migración 013
    // guardan códigos legados ("MAD", "Centro"): el `.eq` crudo las ocultaba al
    // delegado, que veía su bandeja vacía con propuestas pendientes de su zona.
    if (user?.role === "delegado_zona") {
      if (!user.zona) return [];
      const userZone = resolveZoneCode(user.zona) ?? user.zona;
      return list.filter((p) => (resolveZoneCode(p.zona) ?? p.zona) === userZone);
    }
    return list;
  },

  reviewApproval: async (
    id: string,
    approve: boolean,
    reviewer: string,
    reviewerId: string | undefined,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
    comment?: string,
  ): Promise<ApprovalProposal | undefined> => {
    const supabase = db();
    const { data: proposal, error: proposalError } = await supabase
      .from("approval_proposals")
      .select("*")
      .eq("id", id)
      .single();
    // `undefined` aquí lo lee la ruta como «ya la revisó otro»: un fallo de
    // lectura acababa diciéndole al revisor que llegaba tarde.
    if (proposalError && proposalError.code !== "PGRST116") {
      console.error("[roster.reviewApproval.leer]", id, proposalError.message);
      throw new UserFacingServiceError(
        "No se pudo leer la propuesta. No se ha revisado nada; vuelve a intentarlo.",
        409,
      );
    }
    if (!proposal || proposal.status !== "pendiente") return undefined;

    const proposalCompetitionId = String(proposal.competition_id ?? proposal.event_id);
    const proposalCompetitionName = String(proposal.competition_name ?? proposal.event_name);
    const comp = await getCompetitionFn(proposalCompetitionId);
    // Saneado aquí también, no solo en `mapApproval`: este es el camino que
    // ESCRIBE. Un snapshot con forma inesperada llegaba entero al borrado y
    // reinserción del acta, y `Object.entries` sobre una cadena producía
    // asignaciones con claves numéricas.
    const assignments = assignmentsFromJsonb(proposal.assignments);

    // Pre-check ANTES de tocar nada: si un juez de la propuesta se borró del censo,
    // el insert final fallaría por FK dejando el roster vacío y la competición
    // marcada como "Aprobado/Completo" sin asignaciones. Abortamos limpio.
    if (approve && comp) {
      const refereeIds = [...new Set(Object.values(assignments).filter(Boolean))] as string[];
      if (refereeIds.length) {
        const { data: existingRefs, error: refErr } = await supabase
          .from("referees")
          .select("id")
          .in("id", refereeIds);
        if (refErr) {
          throw new ApprovalReviewError("No se pudo validar el censo; inténtalo de nuevo.");
        }
        const existingIds = new Set((existingRefs ?? []).map((r) => String(r.id)));
        const missing = refereeIds.filter((rid) => !existingIds.has(rid));
        if (missing.length) {
          throw new ApprovalReviewError(
            `No se puede aprobar: ${missing.length} juez(ces) de la propuesta ya no existe(n) en el censo. Revisa la tarima y reenvíala.`,
          );
        }
      }
    }

    const now = new Date().toISOString();
    const status = approve ? "aprobado" : "rechazado";
    const reviewerIdCol = (await hasApprovalSubmitterColumns())
      ? { reviewed_by_id: reviewerId ?? null }
      : {};
    // Guard condicional contra doble revisión concurrente: el UPDATE solo gana
    // si la propuesta sigue "pendiente"; si otro revisor llegó antes, no se
    // reescribe el roster ni se duplica la actividad.
    const { data: claimed, error: claimError } = await supabase
      .from("approval_proposals")
      .update({ status, reviewed_by: reviewer, reviewed_at: now, comment: comment ?? null, ...reviewerIdCol })
      .eq("id", id)
      .eq("status", "pendiente")
      .select("id");
    // Cero filas aquí sí significa «otro revisor llegó antes». Un error, no: la
    // ruta lo contaba igual, y el revisor se quedaba creyendo que alguien se le
    // había adelantado cuando lo que había pasado es que no se escribió nada.
    if (claimError) {
      console.error("[roster.reviewApproval.reclamar]", id, claimError.message);
      throw new UserFacingServiceError(
        "No se pudo registrar la revisión. No se ha cambiado nada; vuelve a intentarlo.",
        409,
      );
    }
    if (!claimed || claimed.length === 0) return undefined;

    if (comp) {
      if (approve) {
        // Conserva flags (*, ↑↓) y cross-zona de las filas vivas al re-insertar
        // la propuesta aprobada; antes se perdían y el acta salía sin marcas.
        const { data: liveRows, error: liveError } = await supabase
          .from("roster_assignments")
          .select("slot_key, referee_id, flags, cross_zone, cross_zone_reason")
          .eq("competition_id", proposalCompetitionId);
        // Esta lectura es la copia de seguridad del borrado que viene justo
        // después: si falla y se sigue adelante, no hay nada que restaurar si
        // el insert se tuerce, y de paso el acta pierde flags y cross-zona.
        if (liveError) throw new Error(`roster_assignments: ${liveError.message}`);
        const liveBySlot = new Map(
          (liveRows ?? []).map((r) => [String(r.slot_key), r as Record<string, unknown>]),
        );
        const { error: clearError } = await supabase
          .from("roster_assignments")
          .delete()
          .eq("competition_id", proposalCompetitionId);
        // Si el borrado falla, el insert siguiente chocaría con la clave
        // primaria y el «rollback» duplicaría filas. Mejor parar aquí.
        if (clearError) throw new Error(`roster_assignments: ${clearError.message}`);
        const rows = Object.entries(assignments).map(([slot_key, referee_id]) => {
          const live = liveBySlot.get(slot_key);
          return {
            competition_id: proposalCompetitionId,
            slot_key,
            referee_id,
            flags: live?.flags ?? {},
            cross_zone: live?.cross_zone ?? false,
            cross_zone_reason: live?.cross_zone_reason ?? null,
          };
        });
        if (rows.length) {
          const { error: insertError } = await supabase.from("roster_assignments").insert(rows);
          if (insertError) {
            // El delete ya vació las filas: restauramos exactamente lo que había
            // y revertimos la propuesta a "pendiente" para no dejar un acta vacía
            // marcada como aprobada. No marcamos la competición como Aprobado.
            // El «rollback» también puede fallar, y hasta ahora se daba por
            // hecho que salía bien: el mensaje prometía una tarima intacta y
            // una propuesta pendiente sin comprobar ni una cosa ni la otra.
            const problemas: string[] = [];
            if (liveRows && liveRows.length) {
              const { error: restoreError } = await supabase.from("roster_assignments").insert(
                liveRows.map((r) => ({
                  competition_id: proposalCompetitionId,
                  slot_key: r.slot_key,
                  referee_id: r.referee_id,
                  flags: r.flags ?? {},
                  cross_zone: r.cross_zone ?? false,
                  cross_zone_reason: r.cross_zone_reason ?? null,
                })),
              );
              if (restoreError) {
                problemas.push(
                  "tampoco se pudieron restaurar las asignaciones anteriores, así que la tarima ha quedado vacía",
                );
              }
            }
            const resetReviewer = Object.fromEntries(
              Object.keys(reviewerIdCol).map((k) => [k, null]),
            );
            const { error: resetError } = await supabase
              .from("approval_proposals")
              .update({ status: "pendiente", reviewed_by: null, reviewed_at: null, comment: null, ...resetReviewer })
              .eq("id", id);
            if (resetError) {
              problemas.push("la propuesta se ha quedado marcada como aprobada");
            }
            throw new ApprovalReviewError(
              problemas.length === 0
                ? "No se pudo guardar el acta aprobada; la propuesta sigue pendiente y la tarima se ha dejado como estaba. Inténtalo de nuevo."
                : `No se pudo guardar el acta aprobada y ${problemas.join(", y ")}. Revisa la tarima antes de volver a enviarla.`,
            );
          }
        }
        await markCompetitionReviewed(proposalCompetitionId, {
          aprobacion: "Aprobado",
          estado: "Completo",
          confirmados: Object.values(assignments).filter(Boolean).length,
        });
      } else {
        await markCompetitionReviewed(proposalCompetitionId, { aprobacion: "Rechazado" });
      }
    }
    await pushActivity({
      tipo: approve ? "aprobacion" : "rechazo",
      actor: reviewer,
      accion: approve ? "aprobó roster para" : "rechazó propuesta para",
      evento: proposalCompetitionName,
      hace: "ahora",
    });
    // El motivo del rechazo queda también en el historial de la competición,
    // que es donde lo busca quien tiene que corregirla.
    await pushHistory({
      competitionId: proposalCompetitionId,
      at: now,
      actor: reviewer,
      action: approve ? "Propuesta aprobada" : "Propuesta rechazada",
      detail: comment?.trim() || undefined,
    });
    const { data, error: releerError } = await supabase
      .from("approval_proposals")
      .select("*")
      .eq("id", id)
      .single();
    // La revisión YA está hecha y la tarima reescrita. Devolver `undefined`
    // hacía que la ruta contestara «la propuesta ya fue revisada por otro
    // usuario», que es exactamente lo que no ha pasado.
    if (releerError && releerError.code !== "PGRST116") {
      console.error("[roster.reviewApproval.releer]", id, releerError.message);
      throw new UserFacingServiceError(
        "La revisión se guardó, pero no se pudo releer. Recarga la pantalla.",
        409,
      );
    }
    return data ? mapApproval(data as Record<string, unknown>) : undefined;
  },

  unlockImprevisto: async (
    competitionId: string,
    actor: string,
    getCompetitionFn: (id: string) => Promise<Competition | undefined>,
  ): Promise<{ message: string; aprobacion: string } | { error: string }> => {
    const comp = await getCompetitionFn(competitionId);
    if (!comp) return { error: "Competición no encontrada" };
    const pending = isRosterPendingApproval(comp.aprobacion);
    if (!isRosterLockedByApproval(comp.aprobacion) && !pending) {
      return { error: "La tarima ya se puede editar" };
    }
    const supabase = db();
    // Congelar la tarima con propuesta pendiente sería una trampa sin salida:
    // solo un delegado nacional puede aprobar o rechazar, y la zona se quedaría
    // sin poder ni corregir una baja de última hora. Retirar la propuesta es
    // esa salida, y borrarla es lo que mantiene la garantía: mientras haya una
    // propuesta pendiente, su snapshot y la tarima son lo mismo.
    if (pending) {
      const hasCompetitionColumns = await hasApprovalCompetitionColumns();
      const { error: withdrawError } = await supabase
        .from("approval_proposals")
        .delete()
        .eq(hasCompetitionColumns ? "competition_id" : "event_id", competitionId)
        .eq("status", "pendiente");
      if (withdrawError) throw new Error(`approval_proposals: ${withdrawError.message}`);
    }
    const { error: stateError } = await supabase
      .from("competitions")
      .update({ aprobacion: ROSTER_IMPREVISTO_STATE })
      .eq("id", competitionId);
    if (stateError) throw new Error(`competitions.aprobacion: ${stateError.message}`);
    await pushHistory({
      competitionId,
      at: new Date().toISOString(),
      actor,
      action: pending ? "Propuesta retirada" : "Imprevisto registrado",
      detail: pending
        ? "Propuesta retirada de la bandeja de aprobación; tarima editable de nuevo"
        : "Tarima desbloqueada para cambios; reenviar a aprobación tras ajustar",
    });
    await pushActivity({
      tipo: "cambio",
      actor,
      accion: pending ? "retiró la propuesta de tarima de" : "registró imprevisto en tarima de",
      evento: comp.nombre,
      hace: "ahora",
    });
    return {
      message: pending
        ? "Propuesta retirada; ya puedes editar la tarima"
        : "Tarima desbloqueada para cambios por imprevisto",
      aprobacion: ROSTER_IMPREVISTO_STATE,
    };
  },
};
