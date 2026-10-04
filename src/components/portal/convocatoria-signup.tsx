"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api/client";
import type { PortalConvocatoria } from "@/lib/convocatorias";
import { cn, formatDateRange } from "@/lib/utils";

/**
 * Apuntarse sesión a sesión. Cada botón guarda al momento; no hay «enviar» al
 * final que se pueda olvidar.
 */
export function ConvocatoriaSignup({ initial }: { initial: PortalConvocatoria }) {
  const router = useRouter();
  const [item, setItem] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (sesion: string, inscrito: boolean) => {
    setBusy(sesion);
    setError(null);
    try {
      setItem(inscrito ? await api.retirarseConvocatoria(item.id, sesion) : await api.apuntarseConvocatoria(item.id, sesion));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setBusy(null);
    }
  };

  const cierre = formatDateRange(item.cierraEl, item.cierraEl);
  const apuntadas = item.sesiones.filter((s) => s.inscrito).length;

  return (
    <section aria-labelledby="sesiones" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="sesiones" className="text-[15px] font-semibold text-foreground">
          Sesiones
        </h2>
        <p className="text-xs text-muted-foreground">
          {item.abierta ? `Puedes apuntarte o retirarte hasta el ${cierre}` : `Plazo cerrado el ${cierre}`}
        </p>
      </div>

      {item.bloqueo && (
        <div role="status" className="flex gap-3 rounded-xl border border-warning/30 bg-warning-muted px-4 py-3 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-foreground">{item.bloqueo}</p>
        </div>
      )}
      {!item.bloqueo && item.aviso && (
        <div role="status" className="flex gap-3 rounded-xl border border-border-muted bg-surface px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-foreground-secondary">{item.aviso}</p>
        </div>
      )}

      <ul className="surface-card divide-y divide-border-muted overflow-hidden rounded-xl">
        {item.sesiones.map((s) => {
          // Retirarse se puede aunque haya un bloqueo nuevo (una sanción después
          // de apuntarse): el bloqueo impide apuntarse, no quitarse.
          const disabled = !item.abierta || busy !== null || (!s.inscrito && (Boolean(item.bloqueo) || Boolean(s.bloqueo)));
          return (
            <li key={s.session} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {s.dia ? `${s.dia} · ` : ""}
                  {s.nombre}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {[s.horarioPesaje && `Pesaje ${s.horarioPesaje}`, s.horarioCompeticion && `Competición ${s.horarioCompeticion}`]
                    .filter(Boolean)
                    .join(" · ") || "Horario pendiente"}
                </p>
                {s.bloqueo && <p className="mt-0.5 text-xs text-warning">{s.bloqueo}</p>}
              </div>
              <button
                type="button"
                onClick={() => void toggle(s.session, s.inscrito)}
                disabled={disabled}
                aria-pressed={s.inscrito}
                aria-label={`${s.inscrito ? "Retirarme de" : "Apuntarme a"} ${s.nombre}`}
                className={cn(
                  "inline-flex h-9 min-w-[7.5rem] shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors focus-ring disabled:opacity-50",
                  s.inscrito
                    ? "bg-success-muted text-success hover:bg-success-muted/70"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {busy === s.session ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : s.inscrito ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : null}
                {s.inscrito ? "Apuntado" : "Apuntarme"}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {apuntadas > 0
          ? `Te has apuntado a ${apuntadas} ${apuntadas === 1 ? "sesión" : "sesiones"}. `
          : ""}
        Apuntarte no es una designación: cuando tu delegado monte la tarima y se apruebe, la verás en «Mis sesiones».
        {item.abierta ? " Pulsa de nuevo una sesión para retirarte." : ""}
      </p>
    </section>
  );
}
