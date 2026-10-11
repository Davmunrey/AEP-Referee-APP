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

/**
 * Refresco del servidor que pide la propia pestaña después de guardar algo.
 *
 * Cada escritura en una tabla operativa sube `app_sync_state` (migración 029)
 * y `AppRealtimeSync` refresca la pantalla al recibir el aviso, también en la
 * pestaña que hizo el cambio. Si esa pantalla pedía además su propio
 * `router.refresh()`, la persona que guardaba pagaba dos repintados completos
 * en el servidor por cada cambio (layout, contadores y todas las consultas de
 * la página), y el debounce de la tarima se quedaba en nada: el eco llegaba
 * antes y refrescaba clic a clic.
 *
 * Con esto el refresco propio entra en el MISMO temporizador que los avisos en
 * tiempo real (mismo debounce y mismo tope de espera), así que el eco y la
 * petición local se funden en un único refresco. El estado vive a nivel de
 * módulo por lo mismo que la pausa: quien pide y quien refresca no tienen
 * relación de parentesco.
 */
export interface ServerRefreshScheduler {
  /** Encola un refresco propio (ignora la pausa y la pestaña oculta). */
  request(): void;
  /** Retira el refresco propio pendiente si no lleva ningún aviso remoto. */
  cancel(): void;
}

let refreshScheduler: ServerRefreshScheduler | null = null;

export function registerServerRefreshScheduler(scheduler: ServerRefreshScheduler): void {
  refreshScheduler = scheduler;
}

export function unregisterServerRefreshScheduler(scheduler: ServerRefreshScheduler): void {
  // Solo si sigue siendo el suyo (un montaje nuevo pudo registrarse antes de
  // que corriera la limpieza del anterior).
  if (refreshScheduler === scheduler) refreshScheduler = null;
}

/**
 * Pide un refresco del servidor a través de `AppRealtimeSync`. Devuelve false
 * si no hay nadie que lo atienda (portal, o el componente aún sin cargar): en
 * ese caso quien llama refresca por su cuenta, como hacía antes.
 */
export function requestServerRefresh(): boolean {
  if (!refreshScheduler) return false;
  refreshScheduler.request();
  return true;
}

/** Al desmontar quien lo pidió: el refresco propio pendiente ya no hace falta. */
export function cancelServerRefreshRequest(): void {
  refreshScheduler?.cancel();
}
