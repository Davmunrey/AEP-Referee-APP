import type { AppDataSyncSource } from "@/lib/realtime/sync-events";

/**
 * Temporizador único de refrescos de `AppRealtimeSync`.
 *
 * Avisos remotos (realtime/poll) y refrescos pedidos por la propia pestaña tras
 * guardar comparten debounce y tope de espera, y se funden en un solo
 * `router.refresh()`. Antes eran dos temporizadores que no se veían: quien
 * guardaba en la tarima recibía el eco de su propio cambio y pagaba dos
 * repintados completos en el servidor por cada clic.
 *
 * Aparte del componente para poder probar los tiempos sin montar React.
 */
export interface RefreshCoalescer {
  /** Aviso remoto. El último que entra decide si se avisa a las pantallas. */
  remote(source: AppDataSyncSource): void;
  /** Refresco pedido por la propia pestaña (no cuenta como aviso remoto). */
  local(): void;
  /** Retira el refresco pendiente solo si no lleva ningún aviso remoto. */
  cancelLocal(): void;
  /** Desmontaje: nada pendiente sobrevive. */
  dispose(): void;
}

export function createRefreshCoalescer(opts: {
  debounceMs: number;
  maxWaitMs: number;
  /** `remoteSource`: origen del último aviso remoto fundido; null si solo hubo locales. */
  fire: (remoteSource: AppDataSyncSource | null) => void;
  now?: () => number;
}): RefreshCoalescer {
  const now = opts.now ?? Date.now;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstEventAt: number | null = null;
  let remoteSource: AppDataSyncSource | null = null;

  const reset = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    firstEventAt = null;
    remoteSource = null;
  };

  // Agrupa ráfagas: se espera a que paren, pero nunca más de maxWaitMs desde
  // el primero, para que la pantalla no se quede atrás.
  const schedule = () => {
    const t = now();
    if (firstEventAt === null) firstEventAt = t;
    const waited = t - firstEventAt;
    if (timer) clearTimeout(timer);
    timer = setTimeout(
      () => {
        const source = remoteSource;
        timer = null;
        firstEventAt = null;
        remoteSource = null;
        opts.fire(source);
      },
      Math.max(0, Math.min(opts.debounceMs, opts.maxWaitMs - waited)),
    );
  };

  return {
    remote(source) {
      remoteSource = source;
      schedule();
    },
    local() {
      schedule();
    },
    cancelLocal() {
      // Si ya lleva un aviso remoto, ese refresco tocaba de todos modos.
      if (timer && remoteSource === null) reset();
    },
    dispose: reset,
  };
}
