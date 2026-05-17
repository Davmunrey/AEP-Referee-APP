/**
 * Rellena competitions.template con presets AEP-1/2/3 donde template IS NULL.
 * Uso: npm run db:backfill-templates
 */
import { createClient } from "@supabase/supabase-js";
import { PRESET_AEP1, PRESET_AEP2, PRESET_AEP3 } from "../src/lib/mock-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PRESETS: Record<string, typeof PRESET_AEP1> = {
  "AEP-1": PRESET_AEP1,
  "AEP-2": PRESET_AEP2,
  "AEP-3": PRESET_AEP3,
};

async function backfill() {
  for (const [tipo, template] of Object.entries(PRESETS)) {
    const { data, error } = await admin
      .from("competitions")
      .update({ template })
      .eq("tipo", tipo)
      .is("template", null)
      .select("id, nombre");

    if (error) {
      console.error(`✗ ${tipo}:`, error.message);
      continue;
    }
    console.log(`→ ${tipo}: ${data?.length ?? 0} fila(s) actualizada(s)`);
    for (const row of data ?? []) {
      console.log(`   · ${row.id} — ${row.nombre}`);
    }
  }
  console.log("Listo.");
}

backfill().catch((e) => {
  console.error(e);
  process.exit(1);
});
