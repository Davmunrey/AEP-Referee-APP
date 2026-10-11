"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  dispatchAppDataSync,
  isAutoSyncPaused,
  registerServerRefreshScheduler,
  unregisterServerRefreshScheduler,
  type AppDataSyncSource,
  type ServerRefreshScheduler,
} from "@/lib/realtime/sync-events";
import { createRefreshCoalescer } from "@/components/realtime/refresh-coalescer";

const POLL_MS = 30_000;
// Agrupa ráfagas: importar un cuadrante o recalcular dispara un aviso por fila
// (el trigger de app_sync_state es por fila). Se espera a que paren, pero nunca
// más de MAX_WAIT_MS desde el primero, para que la pantalla no se quede atrás.
const DEBOUNCE_MS = 600;
const MAX_WAIT_MS = 2_000;

/**
 * Mantiene la UI sincronizada con Supabase:
 * - Realtime postgres_changes en `app_sync_state` (migration 029)
 * - Poll de respaldo cada 30 s (solo refresca si cambió la versión)
 * - Refresco al volver a la pestaña
 */
export function AppRealtimeSync() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const versionRef = useRef<number | null>(null);
  // Cambio llegado con la pestaña oculta: se aplica al volver a ella. Con
  // varios delegados trabajando a la vez, cada pestaña de fondo se recargaba en
  // cada cambio de cualquiera (trabajo de servidor que nadie estaba mirando).
  const staleWhileHiddenRef = useRef(false);

  // Un único temporizador para los avisos remotos y para los refrescos que
  // pide la propia pestaña al guardar (ver `refresh-coalescer`).
  const coalescer = useMemo(
    () =>
      createRefreshCoalescer({
        debounceMs: DEBOUNCE_MS,
        maxWaitMs: MAX_WAIT_MS,
        fire: (source) =>
          startTransition(() => {
            router.refresh();
            if (source === "realtime") {
              dispatchAppDataSync(source);
            }
          }),
      }),
    [router],
  );

  const applySync = useCallback(
    (source: AppDataSyncSource) => {
      // Con la sincronización pausada solo pasa el refresco manual. El cambio
      // que se salta no se pierde para siempre: al reanudar, el control fuerza
      // un refresco (la versión ya está anotada y no volvería a dispararse).
      if (source !== "manual" && isAutoSyncPaused()) return;
      if (source !== "manual" && typeof document !== "undefined" && document.hidden) {
        staleWhileHiddenRef.current = true;
        return;
      }
      coalescer.remote(source);
    },
    [coalescer],
  );

  // Refrescos pedidos por la propia pestaña tras guardar (ver
  // `requestServerRefresh`). Fuera de la guarda de Supabase a propósito: con
  // el backend en memoria no hay tiempo real, pero el refresco propio tiene que
  // seguir llegando (y agrupado en ráfagas, como hacía la tarima por su cuenta).
  // No mira la pausa ni la pestaña oculta: lo que uno mismo guarda se reconcilia
  // siempre, igual que cuando cada pantalla llamaba a `router.refresh()`.
  useEffect(() => {
    const scheduler: ServerRefreshScheduler = {
      request: () => coalescer.local(),
      cancel: () => coalescer.cancelLocal(),
    };
    registerServerRefreshScheduler(scheduler);
    return () => {
      unregisterServerRefreshScheduler(scheduler);
      coalescer.dispose();
    };
  }, [coalescer]);

  const pollVersion = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("app_sync_state")
        .select("version")
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return;
      const next = Number(data.version);
      // Un valor ilegible da NaN, y `NaN !== NaN` es SIEMPRE verdadero: la
      // versión nunca coincidiría consigo misma y cada tick del poll dispararía
      // un `router.refresh()`. Serían todas las pantallas de todos los abiertos
      // recargándose cada 30 segundos, sin fin y sin que nada lo explique.
      if (!Number.isFinite(next)) return;
      if (versionRef.current === null) {
        versionRef.current = next;
        return;
      }
      if (next !== versionRef.current) {
        versionRef.current = next;
        applySync("poll");
      }
    } catch {
      // Sin conexión: el siguiente poll lo reintentará.
    }
  }, [applySync]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    let cancelled = false;

    void pollVersion();

    const channel = supabase
      .channel("aep-app-sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_sync_state" },
        (payload) => {
          const next = Number((payload.new as { version?: number })?.version);
          if (!Number.isFinite(next)) return;
          if (versionRef.current === null) {
            versionRef.current = next;
            return;
          }
          if (next !== versionRef.current) {
            versionRef.current = next;
            applySync("realtime");
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void pollVersion();
        }
      });

    const pollId = setInterval(() => {
      // En segundo plano no se sondea: al volver a la pestaña se comprueba.
      if (!cancelled && !document.hidden) void pollVersion();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (staleWhileHiddenRef.current) {
          staleWhileHiddenRef.current = false;
          applySync("realtime");
        }
        void pollVersion();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [applySync, pollVersion]);

  return (
    <span className="sr-only" aria-live="polite" aria-busy={isPending}>
      {isPending ? "Sincronizando datos…" : ""}
    </span>
  );
}
