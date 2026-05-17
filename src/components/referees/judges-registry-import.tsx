"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { JudgesRegistryImportResult } from "@/lib/types";
import { FileSpreadsheet, Loader2, Upload, X } from "lucide-react";

interface JudgesRegistryImportProps {
  open: boolean;
  onClose: () => void;
}

export function JudgesRegistryImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Importar Excel maestro
      </Button>
      <JudgesRegistryImportDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function JudgesRegistryImportDialog({ open, onClose }: JudgesRegistryImportProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JudgesRegistryImportResult | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setReplace(false);
      setError(null);
      setResult(null);
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

  const runImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.importJudgesRegistry(file, replace);
      setResult(res);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="judges-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 id="judges-import-title" className="text-lg font-semibold text-foreground">
              Importar Control jueces
            </h2>
            <p className="mt-1 text-sm text-subtle-muted">
              Hojas «Datos», «Arbitrajes2026» y «Campeonatos26». Actualiza el directorio completo.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-4">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <Button
            type="button"
            variant="outline"
            className="mb-4 w-full gap-2"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {file ? file.name : "Seleccionar Copia de Control jueces.xlsx"}
          </Button>

          <label className="mb-4 flex items-start gap-2 text-sm text-foreground-secondary">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              className="mt-1"
            />
            <span>
              Reemplazar datos existentes (borra jueces y campeonatos actuales antes de importar).
              Solo para carga inicial.
            </span>
          </label>

          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

          {result && (
            <div className="mb-4 rounded-lg border border-border-muted bg-surface/80 p-3 text-sm">
              <p>
                Jueces: {result.refereesCreated} nuevos, {result.refereesUpdated} actualizados
                {result.refereesSkipped > 0 ? `, ${result.refereesSkipped} omitidos` : ""}.
              </p>
              <p className="mt-1">
                Campeonatos: {result.competitionsCreated} nuevos
                {result.competitionsSkipped > 0
                  ? `, ${result.competitionsSkipped} duplicados omitidos`
                  : ""}
                .
              </p>
              {result.warnings.length > 0 && (
                <p className="mt-2 text-xs text-subtle-muted">
                  {result.warnings.length} avisos (revisa consola del servidor).
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            <Button disabled={!file || loading} onClick={() => void runImport()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
