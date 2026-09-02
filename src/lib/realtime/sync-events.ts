/** Evento DOM para avisar a pantallas con estado cliente que deben refetch. */
export const APP_DATA_SYNC_EVENT = "aep:data-sync";

/** Evento DOM que anuncia un cambio en la pausa de sincronización automática. */
export const APP_SYNC_PAUSE_EVENT = "aep:sync-pause";

export type AppDataSyncSource = "realtime" | "poll" | "manual";

export function dispatchAppDataSync(source: AppDataSyncSource): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_DATA_SYNC_EVENT, { detail: { source } }));
}

/**
 * Pausa de la sincronización automática.
 *
 * El estado vive a nivel de módulo porque el control que la activa
 * (`DashboardLive`) y quien la obedece (`AppRealtimeSync`) son dos componentes
 * cliente sin relación de parentesco. Antes el botón «Pausar» solo cambiaba su
 * propia etiqueta: el panel seguía refrescándose con cada cambio en tiempo real
 * y con el poll de 30 s, así que la interfaz decía «Pausado» mientras los datos
 * cambiaban debajo.
 */
let autoSyncPaused = false;

export function isAutoSyncPaused(): boolean {
  return autoSyncPaused;
}

export function setAutoSyncPaused(paused: boolean): void {
  autoSyncPaused = paused;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_SYNC_PAUSE_EVENT, { detail: { paused } }));
}
