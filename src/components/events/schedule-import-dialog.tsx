"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { RosterSession } from "@/lib/types";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportPreview {
  filename: string;
  pages: number;
  sessionCount: number;
  tipoDetected: string;
  warnings: string[];
  header: {
    campeonato?: string;
    sede?: string;
    fechasTexto?: string;
    revision?: string;
  };
}

interface ScheduleImportDialogProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
  onApplied: (template: RosterSession[]) => void;
}

export function ScheduleImportDialog({
  eventId,
  open,
  onClose,
  onApplied,
}: ScheduleImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [template, setTemplate] = useState<RosterSession[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  // drag depth counter avoids flicker when pointer enters child elements
  const [dragDepth, setDragDepth] = useState(0);
  const isDraggingOver = dragDepth > 0;

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setTemplate(null);
      setError(null);
      setLoading(false);
      setApplied(false);
      setDragDepth(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const runPreview = async (selected: File) => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setTemplate(null);
    try {
      const res = await api.importSchedule(eventId, selected, false);
      setPreview(res.preview);
      setTemplate(res.template);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error procesando el PDF");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Solo se admiten archivos PDF.");
      return;
    }
    setFile(f);
    void runPreview(f);
  };

  const apply = async () => {
    if (!template || !file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.importSchedule(eventId, file, true);
      setApplied(true);
      await new Promise<void>((r) => setTimeout(r, 900));
      onApplied(res.template);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la plantilla");
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const root = e.currentTarget;
        const focusable = root.querySelectorAll<HTMLElement>(
          'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && active === last) {
          first.focus();
          e.preventDefault();
        }
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 id="schedule-import-title" className="text-base font-semibold text-foreground">
              Importar horario (PDF)
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sube un horario AEP en PDF (formato oficial). Se generan sesiones, grupos y horarios.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Zona de carga de PDF"
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isDraggingOver
                ? "border-primary bg-primary/5"
                : file
                  ? "border-success/60 bg-success/5"
                  : "border-border hover:border-border-strong hover:bg-surface",
            )}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragDepth((d) => d + 1);
            }}
            onDragLeave={() => setDragDepth((d) => Math.max(0, d - 1))}
            onDrop={(e) => {
              e.preventDefault();
              setDragDepth(0);
              const dropped = e.dataTransfer.files[0];
              if (dropped) handleFile(dropped);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              aria-label="Seleccionar archivo PDF de horario"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : file ? (
              <CheckCircle2 className="h-8 w-8 text-success" />
            ) : (
              <FileUp className={cn("h-8 w-8", isDraggingOver ? "text-primary" : "text-subtle-muted")} />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {loading
                  ? "Procesando PDF…"
                  : file
                    ? file.name
                    : isDraggingOver
                      ? "Suelta el PDF aquí"
                      : "Arrastra un PDF o haz clic para seleccionar"}
              </p>
              {file && !loading && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB · haz clic para cambiar
                </p>
              )}
              {!file && !loading && (
                <p className="mt-0.5 text-xs text-subtle-muted">
                  Formato oficial AEP · solo PDF
                </p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success flash */}
          {applied && (
            <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2.5 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Plantilla aplicada correctamente — cerrando…
            </div>
          )}

          {/* Preview */}
          {preview && !applied && (
            <div className="space-y-3">
              {/* Metadata grid */}
              <div className="grid gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs sm:grid-cols-2">
                {preview.header.campeonato && (
                  <div>
                    <span className="text-subtle-muted">Campeonato:</span>{" "}
                    <span className="font-medium text-foreground">{preview.header.campeonato}</span>
                  </div>
                )}
                <div>
                  <span className="text-subtle-muted">Tipo detectado:</span>{" "}
                  <span className="font-medium text-foreground">{preview.tipoDetected}</span>
                </div>
                {preview.header.sede && (
                  <div>
                    <span className="text-subtle-muted">Sede:</span>{" "}
                    <span className="font-medium text-foreground">{preview.header.sede}</span>
                  </div>
                )}
                {preview.header.fechasTexto && (
                  <div>
                    <span className="text-subtle-muted">Fechas:</span>{" "}
                    <span className="font-medium text-foreground">{preview.header.fechasTexto}</span>
                  </div>
                )}
                <div>
                  <span className="text-subtle-muted">Páginas:</span> {preview.pages}
                </div>
                <div>
                  <span className="text-subtle-muted">Sesiones:</span>{" "}
                  <span className="font-medium text-foreground">{preview.sessionCount}</span>
                </div>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="rounded-md border border-warning-border bg-warning-muted px-3 py-2 text-xs text-warning">
                  <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Avisos del parseo
                  </p>
                  <ul className="space-y-1 pl-5 list-disc">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              {template && (
                <div className="max-h-64 overflow-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-muted shadow-sm">
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Día</th>
                        <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Sesión</th>
                        <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Categorías</th>
                        <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Pesaje</th>
                        <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Competición</th>
                        <th className="px-2 py-2 text-left font-semibold text-subtle-muted">Grupos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {template.map((s) => (
                        <tr key={s.sesion} className="border-t border-border hover:bg-muted/40">
                          <td className="px-2 py-1.5 text-foreground">{s.dia}</td>
                          <td className="px-2 py-1.5 font-medium text-foreground">{s.sesion}</td>
                          <td className="px-2 py-1.5 text-foreground">
                            {s.categorias.map((c) => `${c.genero} ${c.pesos}`).join(" · ") || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {s.horarioPesaje || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {s.horarioCompeticion || "—"}
                          </td>
                          <td className="px-2 py-1.5">
                            {s.grupos && s.grupos.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {s.grupos.map((g, gi) => (
                                  <span
                                    key={gi}
                                    className="inline-flex items-center rounded bg-surface-active px-1.5 py-0.5 text-[10px] text-foreground-secondary"
                                  >
                                    {g.nombre}
                                    {g.levantadores ? (
                                      <span className="ml-1 text-subtle-muted">
                                        ({g.levantadores})
                                      </span>
                                    ) : null}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[11px] text-subtle-muted">
                Aplicar reemplazará la plantilla actual. Las asignaciones en slots que ya no existan
                se eliminarán.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-6 py-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void apply()} disabled={!template || loading || applied}>
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Procesando…
              </>
            ) : applied ? (
              <>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Aplicada
              </>
            ) : (
              "Aplicar plantilla"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
