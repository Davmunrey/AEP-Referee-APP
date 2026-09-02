// import type + submódulo ligero: el barrel de judges-registry re-exporta
// parse-xlsx (→ xlsx, CJS pesado), que se cargaba en el cold start de todas
// las rutas API vía el grafo de dataService.
import type { ParsedJudgesRegistry } from "@/lib/judges-registry/parse-xlsx";
import { inicialesFromNombre } from "@/lib/judges-registry/maps";
import { getPresetForEventType } from "@/lib/roster-template";
import type { JudgesRegistryImportApplyResult, Referee } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAllAssignments, POSTGREST_PAGE_SIZE } from "./supabase-helpers";
import { getStore } from "@/server/store";

function db() {
  return createAdminClient();
}

export async function importJudgesRegistryToSupabase(
  parsed: ParsedJudgesRegistry,
  options?: { replace?: boolean },
): Promise<JudgesRegistryImportApplyResult> {
  const supabase = db();
  const warnings = [...parsed.warnings];
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
      // Si la tabla aún no existe (024 sin aplicar) no hay nada que proteger.
      if (error) break;
      const page = data ?? [];
      for (const row of page) claimedIds.add(String(row.referee_id));
      if (page.length < POSTGREST_PAGE_SIZE) break;
    }

    const { data: allRefs, error: allRefsError } = await supabase
      .from("referees")
      .select("id");
    if (allRefsError) throw new Error(`referees: ${allRefsError.message}`);
    const deletable = (allRefs ?? [])
      .map((r) => String(r.id))
      .filter((id) => !assignedIds.has(id) && !claimedIds.has(id));
    if (deletable.length) {
      const { error } = await supabase.from("referees").delete().in("id", deletable);
      if (error) warnings.push(`No se pudieron eliminar jueces previos: ${error.message}`);
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
  }

  // Una sola carga de ids/excel_ids existentes (antes: 2 SELECT por juez,
  // ~600 round-trips para 300 jueces). Con los mapas en memoria, cada juez
  // necesita como mucho 1 escritura, y las altas van en lotes.
  const { data: existingRefs } = await supabase.from("referees").select("id, excel_id");
  const idByExcelId = new Map<number, string>();
  const existingIds = new Set<string>();
  for (const ref of existingRefs ?? []) {
    existingIds.add(String(ref.id));
    if (ref.excel_id != null) idByExcelId.set(Number(ref.excel_id), String(ref.id));
  }

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
      const { error } = await supabase.from("referees").update(row).eq("id", targetId);
      if (error) {
        refereesSkipped++;
        warnings.push(`${r.nombre}: ${error.message}`);
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
        warnings.push(`${item.nombre}: ${error.message}`);
      } else {
        refereesCreated++;
      }
    }
  }

  // id incluido en la misma consulta: evita el SELECT extra por duplicado
  // dentro del bucle de campeonatos.
  const { data: existingComps } = await supabase.from("competitions").select("id, nombre, fecha");
  const existingIdByKey = new Map<string, string>();
  let nextNum = 1;
  for (const c of existingComps ?? []) {
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
      await supabase
        .from("competitions")
        .update({
          tipo: c.tipo,
          fecha_fin: c.fechaFin,
          sede: c.sede,
          zona: c.zona,
        })
        .eq("id", existingId);
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
      warnings.push(`Campeonato ${c.nombre}: ${error.message}`);
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
