/**
 * Pobla referencia mínima: zonas, normativa, preset de plantilla.
 * NO inserta jueces ni campeonatos — usar `npm run db:import-judges` con el Excel maestro.
 *
 * Uso: npm run db:seed
 */
import { createClient } from "@supabase/supabase-js";
import { PRESET_AEP1, ZONES } from "../src/lib/mock-data";
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

  console.log("→ Configuración (preset plantilla)…");
  await admin.from("app_config").upsert([
    { key: "roster_template", value: PRESET_AEP1 },
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

  console.log("\nListo. Referencia cargada (sin datos demo de jueces/campeonatos).");
  console.log("Importa jueces: npm run db:import-judges -- \"/ruta/Copia de Control jueces.xlsx\"");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
