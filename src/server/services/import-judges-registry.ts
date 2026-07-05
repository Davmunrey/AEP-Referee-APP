import { inicialesFromNombre, type ParsedJudgesRegistry } from "@/lib/judges-registry";
import { getPresetForEventType } from "@/lib/roster-template";
import type { JudgesRegistryImportApplyResult, Referee } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
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
    const { data: assignedRows } = await supabase
      .from("roster_assignments")
      .select("referee_id");
    const assignedIds = new Set(
      (assignedRows ?? []).map((a) => String(a.referee_id)),
    );
    const { data: allRefs } = await supabase.from("referees").select("id");
    const deletable = (allRefs ?? [])
      .map((r) => String(r.id))
      .filter((id) => !assignedIds.has(id));
    if (deletable.length) {
      const { error } = await supabase.from("referees").delete().in("id", deletable);
      if (error) warnings.push(`No se pudieron eliminar jueces previos: ${error.message}`);
    }
    if (assignedIds.size) {
      warnings.push(
        `${assignedIds.size} juez(ces) asignados en alguna tarima no se eliminaron (protección de asignaciones); se actualizan con el Excel.`,
      );
    }
  }

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

    const { data: byExcel } = await supabase
      .from("referees")
      .select("id")
      .eq("excel_id", r.excelId)
      .maybeSingle();

    if (byExcel) {
      const { error } = await supabase.from("referees").update(row).eq("id", byExcel.id);
      if (error) {
        refereesSkipped++;
        warnings.push(`${r.nombre}: ${error.message}`);
      } else {
        refereesUpdated++;
      }
      continue;
    }

    const { data: byId } = await supabase
      .from("referees")
      .select("id")
      .eq("id", r.id)
      .maybeSingle();

    if (byId) {
      const { error } = await supabase.from("referees").update(row).eq("id", r.id);
      if (error) {
        refereesSkipped++;
        warnings.push(`${r.nombre}: ${error.message}`);
      } else {
        refereesUpdated++;
      }
      continue;
    }

    const { error } = await supabase.from("referees").insert(row);
    if (error) {
      refereesSkipped++;
      warnings.push(`${r.nombre}: ${error.message}`);
    } else {
      refereesCreated++;
    }
  }

  const { data: existingComps } = await supabase.from("competitions").select("nombre, fecha");
  const existingKeys = new Set(
    (existingComps ?? []).map(
      (c) => `${String(c.nombre).toLowerCase().trim()}__${String(c.fecha)}`,
    ),
  );

  const { data: idRows } = await supabase.from("competitions").select("id");
  let nextNum = 1;
  for (const row of idRows ?? []) {
    const m = /^evt-(\d+)$/i.exec(String(row.id));
    if (m) nextNum = Math.max(nextNum, parseInt(m[1]!, 10) + 1);
  }

  for (const c of parsed.competitions) {
    const key = `${c.nombre.toLowerCase().trim()}__${c.fecha}`;
    if (existingKeys.has(key)) {
      const { data: existing } = await supabase
        .from("competitions")
        .select("id")
        .eq("nombre", c.nombre)
        .eq("fecha", c.fecha)
        .maybeSingle();
      if (existing?.id) {
        await supabase
          .from("competitions")
          .update({
            tipo: c.tipo,
            fecha_fin: c.fechaFin,
            sede: c.sede,
            zona: c.zona,
          })
          .eq("id", existing.id);
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
      warnings.push(`Campeonato ${c.nombre}: ${error.message}`);
      competitionsSkipped++;
    } else {
      competitionsCreated++;
      existingKeys.add(key);
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
  let nextNum = store.competitions.length + 1;

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
