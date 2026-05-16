"use client";

import { cn } from "@/lib/utils";
import { Pause, Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

const REFRESH_MS = 60_000;

function relativeLabel(seconds: number): string {
  if (seconds < 5) return "ahora mismo";
  if (seconds < 60) return `hace ${seconds}s`;
  const min = Math.floor(seconds / 60);
  return `hace ${min} min`;
}

/**
 * Barra de control en vivo — el panel se retroalimenta solo.
 * Refresca el árbol de servidor cada 60 s vía router.refresh().
 */
export function DashboardLive({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [auto, setAuto] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const baseRef = useRef(Date.now());

  // Reinicia el contador cuando llegan datos nuevos del servidor.
  useEffect(() => {
    baseRef.current = Date.now();
    setElapsed(0);
  }, [generatedAt]);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  // Tick de 1 s para el reloj relativo.
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - baseRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-refresco periódico.
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [auto, refresh]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-muted bg-surface px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          {auto && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              auto ? "bg-success" : "bg-subtle",
            )}
          />
        </span>
        <span className="text-[12px] font-medium text-foreground-secondary">
          {auto ? "Panel en vivo" : "Actualización en pausa"}
        </span>
        <span className="text-[11px] text-subtle-muted">
          · actualizado {relativeLabel(elapsed)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setAuto((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-hover"
        >
          {auto ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {auto ? "Pausar" : "Reanudar"}
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-hover px-2.5 py-1 text-[11.5px] font-medium text-foreground-secondary transition-colors hover:bg-surface-active disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
          {isPending ? "Actualizando" : "Actualizar"}
        </button>
      </div>
    </div>
  );
}
