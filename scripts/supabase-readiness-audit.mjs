import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowedEmails = new Set(
  (process.env.READINESS_ALLOWED_EMAILS ?? "davidmunozrey@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

const criticalTables = [
  "profiles",
  "referees",
  "competitions",
  "roster_assignments",
  "approval_proposals",
  "promotion_requests",
  "activity_log",
  "roster_history",
  "regulation_rules",
  "zones",
  "app_config",
  "health_snapshots",
  "referee_exams",
  "referee_reports",
  "referee_sanctions",
];

const failures = [];
const warnings = [];

function fail(id, detail) {
  failures.push({ id, detail });
}

function warn(id, detail) {
  warnings.push({ id, detail });
}

if (!url) fail("ENV-01", "NEXT_PUBLIC_SUPABASE_URL no configurada");
if (!anonKey) fail("ENV-02", "NEXT_PUBLIC_SUPABASE_ANON_KEY no configurada");
if (!serviceRoleKey) fail("ENV-03", "SUPABASE_SERVICE_ROLE_KEY no configurada");

if (failures.length === 0) {
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const table of criticalTables) {
    const { count, error } = await admin
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) fail("DB-01", `${table}: ${error.message}`);
    else if ((count ?? 0) === 0 && table !== "health_snapshots") {
      warn("DB-02", `${table}: 0 filas`);
    }
  }

  // Migraciones aplicadas a mano en el editor SQL de Supabase: aviso NO
  // bloqueante si faltan, para no romper CI pero recordar que hay que
  // aplicarlas. Van aquí y NO en `criticalTables` a propósito: allí una tabla
  // ausente es fallo duro, y eso dejaría la rama en rojo por una migración
  // pendiente en vez de por un problema de código.
  const schemaChecks = [
    {
      id: "SCHEMA-01",
      detail: "columna referees.user_id (migración 021) no accesible",
      run: () => admin.from("referees").select("user_id", { head: true }).limit(1),
    },
    {
      id: "SCHEMA-02",
      detail: "columna approval_proposals.submitted_by_id (migración 022) no accesible",
      run: () => admin.from("approval_proposals").select("submitted_by_id", { head: true }).limit(1),
    },
    {
      id: "SCHEMA-03",
      detail:
        "columna judge_compensation_claims.travel_amount_override (migración 034) no accesible",
      run: () =>
        admin.from("judge_compensation_claims").select("travel_amount_override", { head: true }).limit(1),
    },
    {
      id: "SCHEMA-04",
      detail: "columnas referees.domicilio_lat/lng (migración 034) no accesibles",
      run: () => admin.from("referees").select("domicilio_lat", { head: true }).limit(1),
    },
    {
      id: "SCHEMA-05",
      detail: "tabla support_tickets (migración 035) no accesible",
      run: () => admin.from("support_tickets").select("id", { head: true }).limit(1),
    },
    {
      id: "SCHEMA-06",
      detail: "tabla support_ticket_comments (migración 035) no accesible",
      run: () => admin.from("support_ticket_comments").select("id", { head: true }).limit(1),
    },
    {
      id: "SCHEMA-07",
      detail: "tabla support_ticket_attachments (migración 035) no accesible",
      run: () => admin.from("support_ticket_attachments").select("id", { head: true }).limit(1),
    },
  ];
  for (const check of schemaChecks) {
    const { error } = await check.run();
    if (error) warn(check.id, `${check.detail}: ${error.message}`);
  }

  const { data: activeProfiles, error: profileError } = await admin
    .from("profiles")
    .select("email, role, zona, activo")
    .eq("activo", true);
  if (profileError) {
    fail("AUTH-01", `profiles: ${profileError.message}`);
  } else {
    const unexpected = (activeProfiles ?? [])
      .map((profile) => String(profile.email ?? "").toLowerCase())
      .filter((email) => !allowedEmails.has(email));
    if (unexpected.length) {
      fail(
        "AUTH-02",
        `Usuarios activos fuera de allowlist: ${unexpected.join(", ")}`,
      );
    }
  }

  for (const table of ["profiles", "referees", "competitions", "referee_reports"]) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    if (error) continue;
    if (Array.isArray(data) && data.length > 0) {
      fail("RLS-01", `${table}: anon puede leer filas; revisar políticas RLS`);
    }
  }
}

if (warnings.length) {
  console.log("Avisos:");
  for (const item of warnings) console.log(`- ${item.id}: ${item.detail}`);
}

if (failures.length) {
  console.error("Supabase readiness: FAIL");
  for (const item of failures) console.error(`- ${item.id}: ${item.detail}`);
  process.exit(1);
}

console.log("Supabase readiness: OK");
console.log(`Tables checked: ${criticalTables.length}`);
console.log(`Allowed active emails: ${[...allowedEmails].join(", ")}`);
