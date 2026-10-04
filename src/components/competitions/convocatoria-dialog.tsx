"use client";

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { dialogOverlayEnter, dialogPanelEnter } from "@/components/aep/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEscapeClose } from "@/hooks/use-escape-close";
import { api } from "@/lib/api/client";
import { addDaysIso, todayIso } from "@/lib/business-date";
import { isConvocatoriaAbierta, type ConvocatoriaStaffView } from "@/lib/convocatorias";
import { contar } from "@/lib/plural";
import type { Competition, Referee, RosterSession } from "@/lib/types";
import { cn, formatDateRange } from "@/lib/utils";

const fecha = (iso: string) => formatDateRange(iso, iso);

/**
 * Lanzar y llevar la convocatoria del campeonato: qué sesiones, hasta cuándo,
 * y quién se ha apuntado a cada una.
 */
export function ConvocatoriaDialog({
  open,
  onClose,
  competition,
  template,
  referees,
  view,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  competition: Pick<Competition, "id" | "nombre" | "fecha">;
  template: RosterSession[];
  referees: Referee[];
  view: ConvocatoriaStaffView | null;
  onChange: (view: ConvocatoriaStaffView | null) => void;
}) {
  const dialogRef = useEscapeClose<HTMLDivElement>(onClose, open);
  const hoy = todayIso();
  // Una semana antes del campeonato, o hoy si ya no da tiempo.
  const cierreSugerido = [addDaysIso(competition.fecha, -7), hoy].sort().at(-1)!;
  const [sesiones, setSesiones] = useState<string[]>(template.map((s) => s.sesion));
  const [cierraEl, setCierraEl] = useState(view?.convocatoria.cierraEl ?? cierreSugerido);
  const [mensaje, setMensaje] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nombres = useMemo(() => new Map(referees.map((r) => [r.id, r.nombre])), [referees]);
  const porSesion = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const i of view?.inscripciones ?? []) out.set(i.sesion, [...(out.get(i.sesion) ?? []), i.refereeId]);
    return out;
  }, [view]);

  if (!open) return null;

  const run = async (fn: () => Promise<ConvocatoriaStaffView | null>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const conv = view?.convocatoria;
  const abierta = conv ? isConvocatoriaAbierta(conv) : false;
  const inscritosTotal = new Set((view?.inscripciones ?? []).map((i) => i.refereeId)).size;
  const sessionLabel = (key: string) => {
    const s = template.find((x) => x.sesion === key);
    return s ? [s.dia, s.nombre || key].filter(Boolean).join(" · ") : `${key} (ya no está en la plantilla)`;
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px] ${dialogOverlayEnter}`} onClick={busy ? undefined : onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="convocatoria-title"
        className={`flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md outline-none ${dialogPanelEnter}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 id="convocatoria-title" className="text-base font-semibold text-foreground">
              Convocatoria
            </h3>
            <p className="truncate text-xs text-muted-foreground">{competition.nombre}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={busy} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {!conv ? (
            <>
              <p className="leading-relaxed text-muted-foreground">
                Los jueces de la zona con cuenta en el portal verán la convocatoria y podrán apuntarse a cada sesión
                hasta la fecha límite. Tú montas después la tarima con los inscritos.
              </p>
              <fieldset className="space-y-1.5">
                <legend className="mb-1.5 text-xs font-medium text-foreground-secondary">Sesiones</legend>
                {template.map((s) => (
                  <label key={s.sesion} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-hover">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={sesiones.includes(s.sesion)}
                      onChange={(e) =>
                        setSesiones((cur) => (e.target.checked ? [...cur, s.sesion] : cur.filter((x) => x !== s.sesion)))
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">{sessionLabel(s.sesion)}</span>
                    {s.horarioCompeticion && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.horarioCompeticion}</span>}
                  </label>
                ))}
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-foreground-secondary">Se pueden apuntar hasta el</span>
                  <Input type="date" value={cierraEl} min={hoy} max={competition.fecha} onChange={(e) => setCierraEl(e.target.value)} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-foreground-secondary">Mensaje para los jueces (opcional)</span>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Horario de llegada, alojamiento, uniforme…"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-subtle focus-visible:border-primary-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15"
                />
              </label>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={cn("font-medium", abierta ? "text-success" : "text-muted-foreground")}>
                  {abierta
                    ? `Abierta hasta el ${fecha(conv.cierraEl)}`
                    : conv.estado === "cerrada"
                      ? "Cerrada"
                      : `Plazo vencido el ${fecha(conv.cierraEl)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {inscritosTotal === 0 ? "Nadie se ha apuntado todavía" : `${contar(inscritosTotal, "juez apuntado", "jueces apuntados")}`}
                </p>
              </div>
              {conv.mensaje && <p className="rounded-lg bg-surface px-3 py-2 text-xs text-foreground-secondary">{conv.mensaje}</p>}
              <ul className="divide-y divide-border-muted rounded-lg border border-border-muted">
                {conv.sesiones.map((key) => {
                  const ids = porSesion.get(key) ?? [];
                  return (
                    <li key={key} className="px-3 py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium text-foreground">{sessionLabel(key)}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{ids.length}</span>
                      </div>
                      {ids.length > 0 && (
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {ids.map((id) => nombres.get(id) ?? id).join(", ")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {conv.estado !== "cancelada" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-foreground-secondary">
                    {abierta ? "Cambiar la fecha límite" : "Reabrir hasta el"}
                  </span>
                  <div className="flex gap-2">
                    <Input type="date" value={cierraEl} min={hoy} max={competition.fecha} onChange={(e) => setCierraEl(e.target.value)} />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0"
                      disabled={busy || !cierraEl || (abierta && cierraEl === conv.cierraEl)}
                      onClick={() => void run(() => api.updateConvocatoria(competition.id, { estado: "abierta", cierraEl }))}
                    >
                      {abierta ? "Guardar" : "Reabrir"}
                    </Button>
                  </div>
                </label>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border-muted px-5 py-3">
          {!conv ? (
            <>
              <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={busy || sesiones.length === 0 || !cierraEl}
                onClick={() =>
                  void run(() =>
                    api.createConvocatoria(competition.id, {
                      sesiones: template.map((s) => s.sesion).filter((s) => sesiones.includes(s)),
                      cierraEl,
                      mensaje: mensaje.trim() || undefined,
                    }),
                  )
                }
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Lanzar convocatoria
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("¿Cancelar la convocatoria? Los jueces dejarán de verla y se perderán las inscripciones.")) return;
                  void run(async () => {
                    await api.updateConvocatoria(competition.id, { estado: "cancelada" });
                    return null;
                  });
                }}
              >
                Cancelar convocatoria
              </Button>
              {abierta && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void run(() => api.updateConvocatoria(competition.id, { estado: "cerrada" }))}
                >
                  Cerrar ahora
                </Button>
              )}
              <Button size="sm" onClick={onClose} disabled={busy}>
                Hecho
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
