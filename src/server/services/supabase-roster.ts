import { rosterAprobacionService } from "./supabase-roster-aprobacion";
import { rosterAsignacionesService } from "./supabase-roster-asignaciones";
import { rosterPlantillaService } from "./supabase-roster-plantilla";

export type { RosterBatchAssignment } from "./supabase-roster-shared";

/**
 * Servicio de la tarima contra Supabase. Antes era un único objeto de 1400
 * líneas; ahora se compone de tres módulos por responsabilidad, con la misma
 * API (los métodos no se llaman entre sí, así que el reparto no cambia nada).
 */
export const rosterService = {
  ...rosterPlantillaService,
  ...rosterAsignacionesService,
  ...rosterAprobacionService,
};
