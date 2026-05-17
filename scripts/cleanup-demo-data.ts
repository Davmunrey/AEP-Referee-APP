/**
 * Elimina datos demo (seed) y deja jueces con excel_id del registro maestro.
 * Uso: npm run db:cleanup-demo
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function cleanup() {
  console.log("→ Borrando actividad demo…");
  await admin.from("activity_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("→ Borrando snapshots demo…");
  await admin.from("health_snapshots").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("→ Borrando jueces sin excel_id (seed j001–j016)…");
  const { data: removed, error } = await admin
    .from("referees")
    .delete()
    .is("excel_id", null)
    .select("id");
  if (error) throw error;

  const { count: remaining } = await admin
    .from("referees")
    .select("*", { count: "exact", head: true });

  console.log(`\nListo. Eliminados ${removed?.length ?? 0} jueces demo.`);
  console.log(`Jueces en BD (Excel): ${remaining ?? 0}`);
}

cleanup().catch((e) => {
  console.error(e);
  process.exit(1);
});
