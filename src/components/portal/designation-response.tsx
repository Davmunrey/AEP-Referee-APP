"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { request } from "@/lib/api/request";
import type { DesignacionRespuesta } from "@/lib/convocatorias";
import { cn } from "@/lib/utils";

/** Confirmar que va a su designación, o decir que no puede (con motivo). */
export function DesignationResponse({ competitionId, initial }: { competitionId: string; initial?: DesignacionRespuesta }) {
  const router = useRouter();
  const [respuesta, setRespuesta] = useState(initial);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (estado: "confirmada" | "rechazada") => {
    setBusy(true);
    setError(null);
    try {
      await request(`/portal/designaciones/${competitionId}`, {
        method: "POST",
        body: JSON.stringify({ estado, motivo: estado === "rechazada" ? motivo : undefined }),
      });
      setRespuesta({ estado, motivo: estado === "rechazada" ? motivo.trim() : undefined });
      setRechazando(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar tu respuesta");
    } finally {
      setBusy(false);
    }
  };

  if (rechazando) {
    return (
      <div className="space-y-2 border-t border-border-muted px-4 py-3">
        <label htmlFor={`motivo-${competitionId}`} className="block text-xs font-medium text-foreground-secondary">
          ¿Por qué no puedes ir? Tu delegado lo verá para buscar sustituto.
        </label>
        <textarea
          id={`motivo-${competitionId}`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:border-primary-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15"
        />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setRechazando(false)} disabled={busy} className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:bg-surface-hover focus-ring">
            Volver
          </button>
          <button
            type="button"
            onClick={() => void enviar("rechazada")}
            disabled={busy || !motivo.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-ring disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Avisar que no puedo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-muted px-4 py-3">
      <p
        className={cn(
          "text-sm",
          respuesta?.estado === "confirmada" ? "font-medium text-success" : respuesta?.estado === "rechazada" ? "font-medium text-destructive" : "text-muted-foreground",
        )}
      >
        {respuesta?.estado === "confirmada"
          ? "Has confirmado que vas"
          : respuesta?.estado === "rechazada"
            ? "Has avisado de que no puedes ir"
            : "¿Confirmas que vas?"}
      </p>
      <div className="flex gap-2">
        {respuesta?.estado !== "rechazada" && (
          <button
            type="button"
            onClick={() => setRechazando(true)}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            No puedo ir
          </button>
        )}
        {respuesta?.estado !== "confirmada" && (
          <button
            type="button"
            onClick={() => void enviar("confirmada")}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-ring disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            {respuesta?.estado === "rechazada" ? "Al final sí voy" : "Confirmo"}
          </button>
        )}
      </div>
      {error && <p role="alert" className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}
