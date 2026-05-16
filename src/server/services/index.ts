import { isSupabaseConfigured } from "@/lib/supabase/env";
import { memoryDataService } from "@/server/services/memory-service";
import { supabaseDataService } from "@/server/services/supabase-service";

/** Postgres en producción; memoria solo sin Supabase (dev local sin vars). */
export const dataService = isSupabaseConfigured()
  ? supabaseDataService
  : memoryDataService;
