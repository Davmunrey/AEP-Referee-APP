import { unstable_cache } from "next/cache";
import type { RegulationRule } from "@/lib/types";
import { mapRegulation } from "@/server/db/mappers";
import { createAdminClient } from "@/lib/supabase/admin";

/** Zonas y normativa cambian poco; TTL de 1 h con tags para invalidación futura. */
const STATIC_TTL_SECONDS = 3600;

async function fetchZones(): Promise<{ code: string; name: string }[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("zones").select("code, name").order("code");
  return (data ?? []).map((z) => ({ code: z.code, name: z.name }));
}

export const getZonesCached = unstable_cache(fetchZones, ["aep-static-zones"], {
  revalidate: STATIC_TTL_SECONDS,
  tags: ["zones"],
});

async function fetchRegulations(): Promise<RegulationRule[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("regulation_rules").select("*");
  return (data ?? []).map((r) => mapRegulation(r as Record<string, unknown>));
}

export const getRegulationsCached = unstable_cache(fetchRegulations, ["aep-static-regulations"], {
  revalidate: STATIC_TTL_SECONDS,
  tags: ["regulations"],
});
