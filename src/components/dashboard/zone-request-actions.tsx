"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";

/** Aceptar o rechazar que los jueces de tu zona vean una convocatoria ajena. */
export function ZoneRequestActions({ convocatoriaId, zona }: { convocatoriaId: string; zona: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"si" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const responder = async (aceptar: boolean) => {
    setBusy(aceptar ? "si" : "no");
    setError(null);
    try {
      await api.resolverZonaConvocatoria(convocatoriaId, zona, aceptar);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setBusy(null);
    }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button size="sm" className="h-7 px-2.5 text-xs" disabled={busy !== null} onClick={() => void responder(true)}>
        {busy === "si" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        Aceptar
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" disabled={busy !== null} onClick={() => void responder(false)}>
        {busy === "no" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
        Rechazar
      </Button>
      {error && <p role="alert" className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}
