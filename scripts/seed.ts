/**
 * Pobla Supabase con datos de referencia (zonas, normativa, árbitros,
 * campeonatos, asignaciones, actividad). NO crea usuarios — el alta de
 * usuarios se hace por inicio de sesión con Google (auto-perfil) o desde
 * /admin/users por el rol nacional.
 *
 * Uso: npm run db:seed
 * Requiere: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY en .env.local
 */
import { createClient } from "@supabase/supabase-js";
import {
  ACTIVITY,
  CALENDAR_EVENTS,
  COMPETITIONS,
  INITIAL_ASSIGNMENTS,
  REFEREES,
  ROSTER_TEMPLATE,
  ZONES,
} from "../src/lib/mock-data";
import { REGULATION_RULES } from "../src/server/store";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log("→ Zonas…");
  await admin.from("zones").upsert(ZONES.map((z) => ({ code: z.code, name: z.name })));

  console.log("→ Configuración…");
  await admin.from("app_config").upsert([
    { key: "roster_template", value: ROSTER_TEMPLATE },
    { key: "calendar_events", value: CALENDAR_EVENTS },
  ]);

  console.log("→ Normativa…");
  await admin.from("regulation_rules").delete().neq("id", "");
  await admin.from("regulation_rules").insert(
    REGULATION_RULES.map((r) => ({
      id: r.id,
      rol: r.rol,
      role_key: r.roleKey,
      min_level: r.minLevel,
      event_types: r.eventTypes,
      note: r.note,
    })),
  );

  console.log("→ Árbitros…");
  await admin.from("referees").upsert(
    REFEREES.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      zona: r.zona,
      nivel: r.nivel,
      estado: r.estado,
      eventos: r.eventos,
      ultimo: r.ultimo,
      disp: r.disp,
      iniciales: r.iniciales,
      email: r.email ?? null,
      licencia: r.licencia ?? null,
    })),
  );

  console.log("→ Campeonatos…");
  await admin.from("competitions").upsert(
    COMPETITIONS.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      fecha: c.fecha,
      fecha_fin: c.fechaFin,
      sede: c.sede,
      sesiones: c.sesiones,
      requeridos: c.requeridos,
      confirmados: c.confirmados,
      estado: c.estado,
      aprobacion: c.aprobacion,
      zona: c.zona ?? null,
    })),
  );

  console.log("→ Asignaciones evt-001…");
  const assignmentRows = Object.entries(INITIAL_ASSIGNMENTS).map(([slot_key, referee_id]) => ({
    competition_id: "evt-001",
    slot_key,
    referee_id,
  }));
  if (assignmentRows.length) {
    await admin.from("roster_assignments").upsert(assignmentRows);
  }

  console.log("→ Actividad…");
  await admin.from("activity_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("activity_log").insert(
    ACTIVITY.map((a) => ({
      tipo: a.tipo,
      actor: a.actor,
      accion: a.accion,
      evento: a.evento,
      hace: a.hace,
    })),
  );

  console.log("\nListo. Datos de referencia poblados.");
  console.log("El primer usuario que inicie sesión con Google será AEP Nacional (admin).");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
