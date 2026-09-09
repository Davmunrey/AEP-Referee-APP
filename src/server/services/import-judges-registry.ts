// import type + submódulo ligero: el barrel de judges-registry re-exporta
// parse-xlsx (→ xlsx, CJS pesado), que se cargaba en el cold start de todas
// las rutas API vía el grafo de dataService.
import type { ParsedJudgesRegistry } from "@/lib/judges-registry/parse-xlsx";
import { inicialesFromNombre } from "@/lib/judges-registry/maps";
import { getPresetForEventType } from "@/lib/roster-template";
import type { JudgesRegistryImportApplyResult, Referee } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  chunkList,
  fetchAllRows,
  IN_FILTER_CHUNK,
  isMissingTableError,
  loadAllAssignments,
  POSTGREST_PAGE_SIZE,
} from "./supabase-helpers";
import { getStore } from "@/server/store";
import { todayIso } from "@/lib/business-date";

function db() {
  return createAdminClient();
}

/**
 * Sanciones por juez, distinguiendo las vivas de las que ya son historial.
 *
 * El Excel del censo no sabe nada de sanciones: la columna «activo» vuelve a
 * poner `estado: Activo` y `disp: true` encima de un juez sancionado, y la
 * ficha quedaba designable con la sanción todavía viva debajo —la misma
 * puerta trasera que el PATCH de la ficha sí cierra—. Y en «reemplazar el
 * censo», borrar al juez se lleva sus sanciones por la cascada de la clave
 * ajena (014:7): el historial disciplinario desaparecía en una reimportación
 * de rutina.
 *
 * La tabla ausente (014 sin aplicar) es el único error tolerable: con
 * cualquier otro no se sabe a quién se está protegiendo y se aborta.
 */
async function loadSanctionedRefereeIds(): Promise<{
  withHistory: Set<string>;
  withActive: Set<string>;
}> {
  const supabase = db();
  const withHistory = new Set<string>();
  const withActive = new Set<string>();
  const { data, error } = await supabase
    .from("referee_sanctions")
    .select("referee_id, status, fecha_fin");
  if (error) {
    if (isMissingTableError(error)) return { withHistory, withActive };
    throw new Error(
      `No se pudo comprobar qué jueces tienen sanciones (${error.message}). No se ha tocado el censo.`,
    );
  }
  const hoy = todayIso();
  for (const row of data ?? []) {
    const refereeId = String((row as { referee_id: unknown }).referee_id);
    withHistory.add(refereeId);
    const r = row as { status?: unknown; fecha_fin?: unknown };
    if (String(r.status) === "activa" && String(r.fecha_fin ?? "").slice(0, 10) >= hoy) {
      withActive.add(refereeId);
    }
  }
  return { withHistory, withActive };
}

/**
 * Para un juez que YA existe, solo se escribe lo que el Excel trae de verdad.
 *
 * La fila se montaba entera y se mandaba tal cual al UPDATE, con `null` en
 * cada columna que el Excel no tiene o trae en blanco. Así que «reemplazar
 * censo» borraba en cada importación datos escritos a mano en la ficha:
 * la licencia, siempre —no hay columna de licencia en el Excel, iba fijada a
 * `null`—; y el e-mail, el teléfono, la localidad, el género, la antigüedad o
 * las notas, cada vez que la celda estuviera vacía. Nadie lo veía: la fila
 * seguía ahí, solo más vacía.
 *
 * Un alta nueva sí puede llevar los nulos: no hay nada que pisar.
 */
function soloLoQueTraeElExcel(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [columna, valor] of Object.entries(payload)) {
    if (columna === "licencia") continue; // el Excel no la conoce
    if (valor === null || valor === undefined) continue;
    out[columna] = valor;
  }
  return out;
}

export async function importJudgesRegistryToSupabase(
  parsed: ParsedJudgesRegistry,
  options?: { replace?: boolean },
): Promise<JudgesRegistryImportApplyResult> {
  const supabase = db();
  const warnings = [...parsed.warnings];
  const sanctioned = await loadSanctionedRefereeIds();
  let refereesCreated = 0;
  let refereesUpdated = 0;
  let refereesSkipped = 0;
  let competitionsCreated = 0;
  let competitionsSkipped = 0;

  if (options?.replace) {
    // «Reemplazar el censo» reimporta el Excel completo. NUNCA borra campeonatos
    // ni cuadrantes (son datos operativos ajenos al Excel) y conserva a los
    // jueces que ya están asignados en alguna tarima (respeta la FK de
    // roster_assignments); esos se avisan en lugar de romper la importación.
    // Vía loadAllAssignments (paginada): el SELECT directo se comía el corte de
    // 1000 filas de PostgREST, así que a partir de ~25 campeonatos había jueces
    // asignados que salían como borrables. La FK de roster_assignments es
    // RESTRICT, de modo que el DELETE en bloque fallaba entero y «reemplazar el
    // censo» se quedaba en no hacer nada, con un aviso.
    const assignmentsByComp = await loadAllAssignments();
    const assignedIds = new Set<string>();
    for (const slots of assignmentsByComp.values()) {
      for (const refereeId of Object.values(slots)) {
        if (refereeId) assignedIds.add(String(refereeId));
      }
    }

    // Las liquidaciones cuelgan del juez con ON DELETE CASCADE (024:17), así
    // que borrarlo se llevaba por delante su dinero, incluido el ya pagado. Es
    // el mismo criterio que protege a los campeonatos con liquidaciones.
    const claimedIds = new Set<string>();
    for (let from = 0; ; from += POSTGREST_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("judge_compensation_claims")
        .select("referee_id")
        .order("id", { ascending: true })
        .range(from, from + POSTGREST_PAGE_SIZE - 1);
      // Solo la tabla ausente (024 sin aplicar) vale como «no hay nada que
      // proteger». Con cualquier otro error, la lista de protegidos quedaría
      // corta y el borrado en bloque se llevaría por delante liquidaciones
      // pagadas por la cascada: se aborta el reemplazo del censo.
      if (error) {
        if (isMissingTableError(error)) break;
        throw new Error(
          `No se pudo comprobar qué jueces tienen liquidaciones (${error.message}). No se ha tocado el censo.`,
        );
      }
      const page = data ?? [];
      for (const row of page) claimedIds.add(String(row.referee_id));
      if (page.length < POSTGREST_PAGE_SIZE) break;
    }

    // Paginado: con el censo por encima de 1000 fichas, el corte de PostgREST
    // dejaba fuera a las últimas y el «reemplazar censo» solo borraba parte.
    const allRefs = await fetchAllRows("referees", "id", "id");
    const deletable = allRefs
      .map((r) => String(r.id))
      .filter(
        (id) => !assignedIds.has(id) && !claimedIds.has(id) && !sanctioned.withHistory.has(id),
      );
    if (deletable.length) {
      // Troceado, como las lecturas: el filtro `in` viaja en la URL, y el censo
      // entero de golpe la pasa de largo. La petición volvía con un error, el
      // borrado no se hacía en absoluto y solo quedaba un aviso: el censo se
      // reemplazaba a medias y nadie lo veía.
      let fallidos = 0;
      for (const trozo of chunkList(deletable, IN_FILTER_CHUNK)) {
        const { error } = await supabase.from("referees").delete().in("id", trozo);
        if (error) {
          fallidos += trozo.length;
          console.error("[import-judges.borrar]", trozo.length, error.message);
        }
      }
      if (fallidos > 0) {
        warnings.push(
          `No se pudieron eliminar ${fallidos} de los ${deletable.length} jueces previos: siguen en el censo. Vuelve a ejecutar el reemplazo o bórralos a mano.`,
        );
      }
    }
    if (assignedIds.size) {
      warnings.push(
        `${assignedIds.size} juez(ces) asignados en alguna tarima no se eliminaron (protección de asignaciones); se actualizan con el Excel.`,
      );
    }
    const claimedOnly = [...claimedIds].filter((id) => !assignedIds.has(id));
    if (claimedOnly.length) {
      warnings.push(
        `${claimedOnly.length} juez(ces) con liquidaciones registradas no se eliminaron (protección de compensaciones); se actualizan con el Excel.`,
      );
    }
    const sanctionedOnly = [...sanctioned.withHistory].filter(
      (id) => !assignedIds.has(id) && !claimedIds.has(id),
    );
    if (sanctionedOnly.length) {
      warnings.push(
        `${sanctionedOnly.length} juez(ces) con sanciones registradas no se eliminaron (borrarlos se llevaría su historial disciplinario); se actualizan con el Excel.`,
      );
    }
  }

  // Una sola carga de ids/excel_ids existentes (antes: 2 SELECT por juez,
  // ~600 round-trips para 300 jueces). Con los mapas en memoria, cada juez
  // necesita como mucho 1 escritura, y las altas van en lotes.
  // Este mapa decide si cada fila del Excel ACTUALIZA a un juez existente o
  // crea uno nuevo. Tragarse el error o quedarse con las primeras 1000 filas lo
  // dejaba vacío o corto, y los jueces que no aparecían se daban de alta otra
  // vez: dos fichas de la misma persona, la vieja con sus asignaciones y sus
  // liquidaciones, la nueva sin nada.
  const existingRefs = await fetchAllRows("referees", "id, excel_id", "id");
  const idByExcelId = new Map<number, string>();
  const existingIds = new Set<string>();
  for (const ref of existingRefs) {
    existingIds.add(String(ref.id));
    if (ref.excel_id != null) idByExcelId.set(Number(ref.excel_id), String(ref.id));
  }

  let sanctionKept = 0;
  const toInsert: { row: Record<string, unknown>; nombre: string }[] = [];
  for (const r of parsed.referees) {
    const row = {
      id: r.id,
      nombre: r.nombre,
      zona: r.zona,
      nivel: r.nivel,
      estado: r.estado,
      eventos: r.eventos,
      ultimo: r.ultimo,
      disp: r.disp,
      iniciales: inicialesFromNombre(r.nombre),
      email: r.email ?? null,
      licencia: null,
      localidad: r.localidad ?? null,
      telefono: r.telefono ?? null,
      genero: r.genero ?? null,
      antiguedad: r.antiguedad ?? null,
      excel_id: r.excelId,
      notas: r.notas ?? null,
      ultimo_fecha: r.ultimoFecha ?? null,
      excel_macro_zone: r.excelMacroZone ?? null,
      arbitraje_stats: r.arbitrajeStats ?? null,
      arbitraje_stats_by_year: r.arbitrajeStatsByYear ?? null,
    };

    const targetId = idByExcelId.get(r.excelId) ?? (existingIds.has(r.id) ? r.id : undefined);
    if (targetId) {
      // `id` fuera del payload: la fila se localiza por `targetId`, así que
      // incluirlo solo puede reescribir la clave primaria de un juez existente
      // y dejar colgadas las referencias que no son clave ajena (las
      // asignaciones guardadas dentro de una propuesta de aprobación).
      //
      // Y el Excel no sabe de sanciones: su columna «activo» devolvía a Activo
      // y disponible a un juez sancionado, con la sanción todavía viva debajo.
      // El resto de sus datos sí se actualiza.
      const { id: _id, estado, disp, ...resto } = row;
      const conSancionViva = sanctioned.withActive.has(targetId);
      if (conSancionViva) sanctionKept++;
      const updatePayload = soloLoQueTraeElExcel(conSancionViva ? resto : { ...resto, estado, disp });
      const { error } = await supabase.from("referees").update(updatePayload).eq("id", targetId);
      if (error) {
        refereesSkipped++;
        // Igual que en las altas, más abajo: el detalle de Postgres al log.
        console.error("[censo.actualizar]", r.nombre, error.message);
        warnings.push(`${r.nombre}: no se pudo actualizar.`);
      } else {
        refereesUpdated++;
      }
      continue;
    }
    toInsert.push({ row, nombre: r.nombre });
  }

  // Altas por lotes; si un lote falla (fila conflictiva), cae a fila a fila
  // para conservar la atribución del error en los warnings.
  const INSERT_CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    const { error: chunkError } = await supabase
      .from("referees")
      .insert(chunk.map((c) => c.row));
    if (!chunkError) {
      refereesCreated += chunk.length;
      continue;
    }
    for (const item of chunk) {
      const { error } = await supabase.from("referees").insert(item.row);
      if (error) {
        refereesSkipped++;
        // Igual que con los campeonatos: al que importa se le dice qué juez no
        // entró; el detalle de Postgres se queda en el log.
        console.error("[censo.crear]", item.nombre, error.message);
        warnings.push(`${item.nombre}: no se pudo dar de alta.`);
      } else {
        refereesCreated++;
      }
    }
  }

  if (sanctionKept > 0) {
    warnings.push(
      `${sanctionKept} juez(ces) con sanción activa conservan su estado «Sancionado» (el Excel no conoce las sanciones); el resto de sus datos sí se ha actualizado.`,
    );
  }

  // id incluido en la misma consulta: evita el SELECT extra por duplicado
  // dentro del bucle de campeonatos.
  // Mismo riesgo que con los jueces: sin esta lista completa, los campeonatos
  // del Excel se crean duplicados y `nextNum` arranca por debajo del máximo
  // real, así que los identificadores `evt-N` chocan con los que ya existen.
  const existingComps = await fetchAllRows("competitions", "id, nombre, fecha", "id");
  const existingIdByKey = new Map<string, string>();
  let nextNum = 1;
  for (const c of existingComps) {
    existingIdByKey.set(
      `${String(c.nombre).toLowerCase().trim()}__${String(c.fecha)}`,
      String(c.id),
    );
    const m = /^evt-(\d+)$/i.exec(String(c.id));
    if (m) nextNum = Math.max(nextNum, parseInt(m[1]!, 10) + 1);
  }

  for (const c of parsed.competitions) {
    const key = `${c.nombre.toLowerCase().trim()}__${c.fecha}`;
    const existingId = existingIdByKey.get(key);
    if (existingId) {
      const { error: updateError } = await supabase
        .from("competitions")
        .update({
          tipo: c.tipo,
          fecha_fin: c.fechaFin,
          sede: c.sede,
          zona: c.zona,
        })
        .eq("id", existingId);
      // La importación contaba el campeonato como «actualizado» sin mirar si
      // la escritura había ido bien: el resumen decía que la sede o la zona
      // estaban al día cuando seguían como antes.
      if (updateError) {
        console.error("[calendario.actualizar]", existingId, updateError.message);
        warnings.push(`Campeonato ${c.nombre}: no se pudo actualizar; queda como estaba.`);
        competitionsSkipped++;
        continue;
      }
      competitionsSkipped++;
      continue;
    }
    const id = `evt-${String(nextNum).padStart(3, "0")}`;
    nextNum += 1;
    const template = getPresetForEventType(c.tipo);
    const { error } = await supabase.from("competitions").insert({
      id,
      nombre: c.nombre,
      tipo: c.tipo,
      fecha: c.fecha,
      fecha_fin: c.fechaFin,
      sede: c.sede,
      sesiones: c.tipo === "AEP-1" ? 4 : c.tipo === "AEP-2" ? 3 : 2,
      requeridos: c.tipo === "AEP-1" ? 12 : c.tipo === "AEP-2" ? 9 : 6,
      confirmados: 0,
      estado: "Borrador",
      aprobacion: "Sin propuesta",
      zona: c.zona,
      template,
    });
    if (error) {
      // El aviso lo lee quien importa, no quien administra la base: el detalle
      // de Postgres —nombres de tabla y de restricción— se queda en el log.
      console.error("[calendario.crear]", c.nombre, error.message);
      warnings.push(`Campeonato ${c.nombre}: no se pudo crear.`);
      competitionsSkipped++;
    } else {
      competitionsCreated++;
      existingIdByKey.set(key, id);
    }
  }

  return {
    refereesCreated,
    refereesUpdated,
    refereesSkipped,
    competitionsCreated,
    competitionsSkipped,
    warnings,
  };
}

export function importJudgesRegistryToMemory(
  parsed: ParsedJudgesRegistry,
  options?: { replace?: boolean },
): JudgesRegistryImportApplyResult {
  const store = getStore();
  const warnings = [...parsed.warnings];
  let refereesCreated = 0;
  let refereesUpdated = 0;

  if (options?.replace) {
    // Igual que en Supabase: no borra campeonatos ni cuadrantes; conserva a los
    // jueces ya asignados en alguna tarima y reimporta el resto desde el Excel.
    const assignedIds = new Set<string>();
    for (const map of store.assignments.values()) {
      for (const rid of Object.values(map)) if (rid) assignedIds.add(String(rid));
    }
    store.referees = store.referees.filter((r) => assignedIds.has(String(r.id)));
  }

  for (const r of parsed.referees) {
    const referee: Referee = {
      id: r.id,
      nombre: r.nombre,
      zona: r.zona,
      nivel: r.nivel,
      estado: r.estado,
      eventos: r.eventos,
      ultimo: r.ultimo,
      disp: r.disp,
      iniciales: inicialesFromNombre(r.nombre),
      email: r.email,
      localidad: r.localidad,
      telefono: r.telefono,
      genero: r.genero,
      antiguedad: r.antiguedad,
      excelId: r.excelId,
      notas: r.notas,
      ultimoFecha: r.ultimoFecha,
      excelMacroZone: r.excelMacroZone,
      arbitrajeStats: r.arbitrajeStats,
      arbitrajeStatsByYear: r.arbitrajeStatsByYear,
    };
    const idx = store.referees.findIndex(
      (x) => x.excelId === r.excelId || x.id === r.id,
    );
    if (idx >= 0) {
      store.referees[idx] = referee;
      refereesUpdated++;
    } else {
      store.referees.push(referee);
      refereesCreated++;
    }
  }

  let competitionsCreated = 0;
  let competitionsSkipped = 0;
  const existingKeys = new Set(
    store.competitions.map((c) => `${c.nombre.toLowerCase().trim()}__${c.fecha}`),
  );
  // max(existing evt-N)+1, no length+1 (un borrado intermedio reutilizaría un id).
  let nextNum = store.competitions.reduce((max, c) => {
    const m = /^evt-(\d+)$/i.exec(String(c.id));
    return m ? Math.max(max, parseInt(m[1]!, 10)) : max;
  }, 0) + 1;

  for (const c of parsed.competitions) {
    const key = `${c.nombre.toLowerCase().trim()}__${c.fecha}`;
    if (existingKeys.has(key)) {
      competitionsSkipped++;
      continue;
    }
    const id = `evt-${String(nextNum).padStart(3, "0")}`;
    nextNum++;
    store.competitions.push({
      id,
      nombre: c.nombre,
      tipo: c.tipo,
      fecha: c.fecha,
      fechaFin: c.fechaFin,
      sede: c.sede,
      sesiones: c.tipo === "AEP-1" ? 4 : c.tipo === "AEP-2" ? 3 : 2,
      requeridos: c.tipo === "AEP-1" ? 12 : c.tipo === "AEP-2" ? 9 : 6,
      confirmados: 0,
      estado: "Borrador",
      aprobacion: "Sin propuesta",
      zona: c.zona,
    });
    store.assignments.set(id, {});
    store.slotFlags.set(id, {});
    competitionsCreated++;
    existingKeys.add(key);
  }

  return {
    refereesCreated,
    refereesUpdated,
    refereesSkipped: 0,
    competitionsCreated,
    competitionsSkipped,
    warnings,
  };
}
