"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { RosterSession } from "@/lib/types";
import { AlertTriangle, FileUp, Loader2, X } from "lucide-react";

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

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setTemplate(null);
      setError(null);
      setLoading(false);
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
    setFile(f);
    runPreview(f);
  };

  const apply = async () => {
    if (!template) return;
    setLoading(true);
    setError(null);
    try {
      await api.saveTemplate(eventId, template);
      onApplied(template);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la plantilla");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-xl">
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

        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              aria-label="Seleccionar archivo PDF de horario"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {file ? "Cambiar PDF" : "Seleccionar PDF"}
            </Button>
            {file && (
              <span className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </span>
            )}
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="grid gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs sm:grid-cols-2">
                {preview.header.campeonato && (
                  <div>
                    <span className="text-subtle-muted">Campeonato:</span>{" "}
                    <span className="text-foreground">{preview.header.campeonato}</span>
                  </div>
                )}
                <div>
                  <span className="text-subtle-muted">Tipo detectado:</span>{" "}
                  <span className="text-foreground">{preview.tipoDetected}</span>
                </div>
                {preview.header.sede && (
                  <div>
                    <span className="text-subtle-muted">Sede:</span>{" "}
                    <span className="text-foreground">{preview.header.sede}</span>
                  </div>
                )}
                {preview.header.fechasTexto && (
                  <div>
                    <span className="text-subtle-muted">Fechas:</span>{" "}
                    <span className="text-foreground">{preview.header.fechasTexto}</span>
                  </div>
                )}
                <div>
                  <span className="text-subtle-muted">Páginas:</span> {preview.pages}
                </div>
                <div>
                  <span className="text-subtle-muted">Sesiones:</span> {preview.sessionCount}
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="rounded-md border border-warning-border bg-warning-muted px-3 py-2 text-xs text-warning">
                  <p className="mb-1 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Avisos del parseo
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {template && (
                <div className="max-h-72 overflow-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-subtle-muted">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Día</th>
                        <th className="px-2 py-1.5 text-left">Sesión</th>
                        <th className="px-2 py-1.5 text-left">Categorías</th>
                        <th className="px-2 py-1.5 text-left">Pesaje</th>
                        <th className="px-2 py-1.5 text-left">Competición</th>
                        <th className="px-2 py-1.5 text-left">Grupos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {template.map((s) => (
                        <tr key={s.sesion} className="border-t border-border">
                          <td className="px-2 py-1.5 text-foreground">{s.dia}</td>
                          <td className="px-2 py-1.5 font-medium text-foreground">{s.sesion}</td>
                          <td className="px-2 py-1.5 text-foreground">
                            {s.categorias
                              .map((c) => `${c.genero} ${c.pesos}`)
                              .join(" · ") || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">{s.horarioPesaje || "—"}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {s.horarioCompeticion || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {s.grupos && s.grupos.length > 0
                              ? s.grupos
                                  .map(
                                    (g) =>
                                      `${g.nombre}${g.levantadores ? ` (${g.levantadores})` : ""}`,
                                  )
                                  .join(", ")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[11px] text-subtle-muted">
                Aplicar reemplazará la plantilla actual. Las asignaciones en slots que ya no existan se eliminarán.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-6 py-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={apply} disabled={!template || loading}>
            {loading ? "Procesando…" : "Aplicar plantilla"}
          </Button>
        </div>
      </div>
    </div>
  );
}
