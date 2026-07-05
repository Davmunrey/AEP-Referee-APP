import { isSupabaseConfigured } from "@/lib/supabase/env";
import { memoryDataService } from "@/server/services/memory-service";
import { supabaseDataService } from "@/server/services/supabase-service";

/**
 * Contrato único de la capa de datos. El backend de producción (Supabase) es la
 * fuente de verdad de la forma; el backend en memoria (dev) DEBE satisfacerlo.
 */
export type DataService = typeof supabaseDataService;

// Garantía en compilación de que ambos backends exponen el mismo contrato: si el
// backend en memoria diverge (método que falta o firma incompatible), tsc falla.
void (memoryDataService satisfies DataService);

/** Postgres en producción; memoria solo sin Supabase (dev local sin vars). */
export const dataService: DataService = isSupabaseConfigured()
  ? supabaseDataService
  : memoryDataService;
