/**
 * Pobla Supabase con datos iniciales y usuarios federativos.
 * Uso: npx tsx scripts/seed.ts
 * Requiere: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY en .env.local
 */
import { createClerkClient } from "@clerk/backend";
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
const clerkSecret = process.env.CLERK_SECRET_KEY;

if (!url || !serviceKey) {
  console.error("Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!clerkSecret) {
  console.error("Configura CLERK_SECRET_KEY para crear usuarios");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: clerkSecret });

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "ChangeMe2026!";

const FEDERATIVE_USERS = [
  {
    email: "nacional@aep-tarima.es",
    nombre: "María González",
    rolLabel: "Directora Arbitraje Nacional",
    role: "nacional" as const,
    zona: null,
  },
  {
    email: "madrid@aep-tarima.es",
    nombre: "Carlos Méndez",
    rolLabel: "Resp. Madrid",
    role: "regional" as const,
    zona: "MAD",
  },
  {
    email: "cataluna@aep-tarima.es",
    nombre: "Laura Puig",
    rolLabel: "Resp. Cataluña",
    role: "regional" as const,
    zona: "CAT",
  },
  {
    email: "paisvasco@aep-tarima.es",
    nombre: "Jon Arizmendi",
    rolLabel: "Resp. País Vasco",
    role: "regional" as const,
    zona: "PVA",
  },
  {
    email: "consulta@aep-tarima.es",
    nombre: "Ana Consulta",
    rolLabel: "Auditoría · Solo lectura",
    role: "lectura" as const,
    zona: "MAD",
  },
];

async function seed() {
  console.log("→ Zonas…");
  await admin.from("zones").upsert(ZONES.map((z) => ({ code: z.code, name: z.name })));

  console.log("→ Configuración…");
  await admin.from("app_config").upsert([
    { key: "roster_template", value: ROSTER_TEMPLATE },
    { key: "calendar_events", value: CALENDAR_EVENTS },
  ]);

  console.log("→ Normativa…");
  await admin.from("regulation_rules").upsert(
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

  console.log("→ Usuarios Clerk + perfiles…");
  for (const u of FEDERATIVE_USERS) {
    const iniciales = u.nombre
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const { data: existing } = await admin.from("profiles").select("id").eq("email", u.email).maybeSingle();
    if (existing) {
      console.log(`  · ${u.email} ya existe, omitido`);
      continue;
    }

    const nameParts = u.nombre.split(" ");
    let clerkUserId: string;
    try {
      const created = await clerk.users.createUser({
        emailAddress: [u.email],
        password: SEED_PASSWORD,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" ") || undefined,
      });
      clerkUserId = created.id;
    } catch (err) {
      console.warn(`  ! ${u.email}:`, err instanceof Error ? err.message : err);
      continue;
    }

    await admin.from("profiles").insert({
      id: clerkUserId,
      email: u.email,
      nombre: u.nombre,
      rol_label: u.rolLabel,
      iniciales,
      role: u.role,
      zona: u.zona,
      activo: true,
    });
    console.log(`  ✓ ${u.email}`);
  }

  console.log("\nListo. Contraseña inicial de usuarios seed:", SEED_PASSWORD);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
