import { isClerkConfigured } from "@/lib/clerk/env";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { memoryDataService } from "@/server/services/memory-service";
import { supabaseDataService } from "@/server/services/supabase-service";

/** Postgres + Clerk en producción; memoria solo sin Supabase (dev local). */
export const dataService =
  isSupabaseConfigured() && isClerkConfigured()
    ? supabaseDataService
    : memoryDataService;
