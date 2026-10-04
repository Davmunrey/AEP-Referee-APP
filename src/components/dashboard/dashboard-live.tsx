"use client";

import { cn } from "@/lib/utils";
import { Pause, Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { APP_DATA_SYNC_EVENT, setAutoSyncPaused } from "@/lib/realtime/sync-events";

function relativeLabel(seconds: number): string {
  if (seconds < 5) return "ahora mismo";
  if (seconds < 60) return `hace ${seconds} s`;
  const min = Math.floor(seconds / 60);
  return `hace ${min} min`;
}

/**
 * Barra de control en vivo — refleja la sincronización global (AppRealtimeSync).
 */
export function DashboardLive({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [auto, setAuto] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const baseRef = useRef(Date.now());

  const markSynced = useCallback(() => {
    baseRef.current = Date.now();
    setElapsed(0);
  }, []);

  useEffect(() => {
    markSynced();
  }, [generatedAt, markSynced]);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  // El botón solo cambiaba su propia etiqueta: la sincronización global seguía
  // refrescando con cada cambio en tiempo real y con el poll de 30 s, así que
  // la barra decía «Pausado» mientras los datos cambiaban debajo. Ahora la
  // pausa es real, y al reanudar se refresca de inmediato: mientras estuvo
  // pausada la versión siguió anotándose, de modo que ningún cambio posterior
  // dispararía por sí solo el refresco que faltaba.
  const toggleAuto = useCallback(() => {
    setAuto((prev) => {
      const next = !prev;
      setAutoSyncPaused(!next);
      if (next) refresh();
      return next;
    });
  }, [refresh]);

  // Si la pantalla se desmonta pausada, la pausa no puede quedarse activa para
  // el resto de la aplicación.
  useEffect(() => () => setAutoSyncPaused(false), []);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - baseRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const onSync = () => markSynced();
    window.addEventListener(APP_DATA_SYNC_EVENT, onSync);
    return () => window.removeEventListener(APP_DATA_SYNC_EVENT, onSync);
  }, [auto, markSynced]);

  // Compacto, junto a las acciones del encabezado: antes ocupaba una franja
  // propia a todo el ancho encima del saludo. Sin `aria-live`: el contador
  // cambia cada segundo y un lector de pantalla lo anunciaría sin parar.
  const iconButton =
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-ring disabled:opacity-40";
  return (
    <div className="flex h-8 items-center gap-1 rounded-lg border border-border-muted bg-card pl-2.5 pr-0.5">
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", auto ? "bg-success" : "bg-muted-foreground/40")}
        aria-hidden="true"
      />
      {/* tabular-nums: el contador se reescribe cada segundo; con cifras de
          ancho variable la línea entera daría un salto por tick. */}
      <span className="mr-1 text-xs tabular-nums text-muted-foreground">
        {isPending ? "Actualizando…" : auto ? `Actualizado ${relativeLabel(elapsed)}` : "En pausa"}
      </span>
      <button
        type="button"
        onClick={toggleAuto}
        aria-label={auto ? "Pausar actualización automática" : "Reanudar actualización automática"}
        title={auto ? "Pausar actualización automática" : "Reanudar actualización automática"}
        className={iconButton}
      >
        {auto ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      <button
        type="button"
        onClick={refresh}
        disabled={isPending}
        aria-label="Actualizar panel ahora"
        title="Actualizar ahora"
        className={iconButton}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} aria-hidden="true" />
      </button>
    </div>
  );
}
