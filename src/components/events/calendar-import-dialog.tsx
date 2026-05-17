"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  FileUp,
  Loader2,
  X,
} from "lucide-react";

interface CalendarPreview {
  filename: string;
  year: number;
  totalDetected: number;
  eligibleCount: number;
  duplicateCount: number;
  dbDuplicateCount: number;
  toCreateCount: number;
  warnings: string[];
  entries: Array<{
    rawDate: string;
    fechaInicio: string | null;
    fechaFin: string | null;
    nombre: string;
    localidad: string;
    organizador: string;
    tipo: string | null;
    zona?: string;
    pendiente: boolean;
    nuevo: boolean;
  }>;
}

interface CalendarImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CalendarImportDialog({ open, onClose }: CalendarImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CalendarPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{
    created: number;
    dedupeRemoved: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setError(null);
      setLoading(false);
      setApplyResult(null);
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
    try {
      const res = await api.importCalendar(selected, false);
      setPreview(res.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error procesando el calendario");
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
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.importCalendar(file, true);
      setApplyResult({
        created: res.created ?? 0,
        dedupeRemoved: res.dedupeRemoved ?? 0,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron crear los campeonatos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2
              id="calendar-import-title"
              className="flex items-center gap-2 text-base font-semibold text-foreground"
            >
              <CalendarPlus className="h-4 w-4 text-primary" aria-hidden="true" />
              Importar Calendario AEP (PDF)
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Solo se crearán competiciones de ámbito español (AEP-1 / AEP-2 / AEP-3). Las europeas / mundiales se descartan.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              aria-label="Seleccionar PDF de calendario AEP"
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
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {applyResult !== null && (
            <div className="flex items-start gap-2 rounded-md border border-success-border bg-success-muted px-3 py-2 text-xs text-success">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {applyResult.dedupeRemoved > 0 && (
                  <>
                    Se eliminaron {applyResult.dedupeRemoved} duplicado
                    {applyResult.dedupeRemoved !== 1 ? "s" : ""} en la base de datos.{" "}
                  </>
                )}
                Se crearon {applyResult.created} competición
                {applyResult.created !== 1 ? "es" : ""}. Ya disponibles en el listado.
              </span>
            </div>
          )}

          {preview && applyResult === null && (
            <div className="space-y-3">
              <div className="grid gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-subtle-muted">Año:</span>{" "}
                  <span className="text-foreground">{preview.year}</span>
                </div>
                <div>
                  <span className="text-subtle-muted">Detectadas:</span>{" "}
                  <span className="text-foreground">{preview.totalDetected}</span>
                </div>
                <div>
                  <span className="text-subtle-muted">Españolas elegibles:</span>{" "}
                  <span className="text-foreground">{preview.eligibleCount}</span>
                </div>
                <div>
                  <span className="text-subtle-muted">Duplicadas (PDF vs BD):</span>{" "}
                  <span className="text-foreground">{preview.duplicateCount}</span>
                </div>
                <div>
                  <span className="text-subtle-muted">Duplicados en BD (limpia al aplicar):</span>{" "}
                  <span className="text-foreground">{preview.dbDuplicateCount}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-subtle-muted">A crear:</span>{" "}
                  <span className="font-semibold text-foreground">{preview.toCreateCount}</span>
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="rounded-md border border-warning-border bg-warning-muted px-3 py-2 text-xs text-warning">
                  <p className="mb-1 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Avisos del parseo
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="max-h-72 overflow-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted text-subtle-muted">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Fecha</th>
                      <th className="px-2 py-1.5 text-left">Tipo</th>
                      <th className="px-2 py-1.5 text-left">Nombre</th>
                      <th className="px-2 py-1.5 text-left">Localidad</th>
                      <th className="px-2 py-1.5 text-left">Zona</th>
                      <th className="px-2 py-1.5 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.entries.map((e, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-2 py-1.5 font-mono text-[10.5px] text-muted-foreground">
                          {e.fechaInicio ?? "pendiente"}
                          {e.fechaFin && e.fechaFin !== e.fechaInicio && ` → ${e.fechaFin}`}
                        </td>
                        <td className="px-2 py-1.5 text-foreground">{e.tipo}</td>
                        <td className="px-2 py-1.5 text-foreground">{e.nombre}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{e.localidad}</td>
                        <td className="px-2 py-1.5 font-mono text-[10.5px] text-muted-foreground">
                          {e.zona ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-[10.5px]">
                          {e.pendiente ? (
                            <span className="text-warning">pendiente</span>
                          ) : e.nuevo ? (
                            <span className="text-success">nueva</span>
                          ) : (
                            <span className="text-subtle-muted">duplicada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-subtle-muted">
                Al aplicar: primero se eliminan duplicados en BD (mismo nombre, fecha y tipo; se
                conserva el que más tarima tenga), luego se crean las {preview.toCreateCount}{" "}
                marcadas «nueva». Las del PDF ya existentes y «pendientes» se omiten.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-6 py-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {applyResult !== null ? "Cerrar" : "Cancelar"}
          </Button>
          {applyResult === null && (
            <Button
              type="button"
              onClick={apply}
              disabled={
                !preview ||
                loading ||
                (preview.toCreateCount === 0 && preview.dbDuplicateCount === 0)
              }
            >
              {loading
                ? "Aplicando…"
                : preview && preview.dbDuplicateCount > 0 && preview.toCreateCount === 0
                  ? `Limpiar ${preview.dbDuplicateCount} duplicado${preview.dbDuplicateCount !== 1 ? "s" : ""}`
                  : `Aplicar (${preview?.toCreateCount ?? 0} nuevas${preview && preview.dbDuplicateCount > 0 ? `, limpia ${preview.dbDuplicateCount} dup.` : ""})`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
