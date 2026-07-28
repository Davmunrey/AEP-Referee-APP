"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/data-transfer/file-drop-zone";
import { TransferDialogShell } from "@/components/data-transfer/transfer-dialog-shell";
import { TransferPreviewStats } from "@/components/data-transfer/transfer-preview-stats";
import { TransferResultBanner } from "@/components/data-transfer/transfer-result-banner";
import { TransferStepper } from "@/components/data-transfer/transfer-stepper";
import { TransferWarnings } from "@/components/data-transfer/transfer-warnings";
import { formatApiError } from "@/lib/api/error-message";
import { api } from "@/lib/api/client";
import type { AssignmentsMap, FlagsMap } from "@/lib/types";
import type { TransferStep } from "@/lib/import-export-ui";
import { Loader2 } from "lucide-react";

interface Candidate {
  key: string;
  session: string;
  roleLabel: string;
  slotKey: string | null;
  refereeName: string;
  matchedName?: string;
  confidence: "alta" | "media" | "baja";
  importable: boolean;
  selected: boolean;
  reason: string;
}

interface Preview {
  filename: string;
  pages: number;
  detectedCount: number;
  importableCount: number;
  selectedCount: number;
  warnings: string[];
  candidates: Candidate[];
}

interface QuadrantImportDialogProps {
  competitionId: string;
  open: boolean;
  onClose: () => void;
  onApplied: (assignments: AssignmentsMap, flags?: FlagsMap) => void;
}

export function QuadrantImportDialog({
  competitionId,
  open,
  onClose,
  onApplied,
}: QuadrantImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ applied: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setSelectedKeys(new Set());
      setLoading(false);
      setError(null);
      setResult(null);
    }
  }, [open]);

  const step: TransferStep = result ? "result" : preview ? "preview" : "upload";
  const selectedCount = selectedKeys.size;
  const importableCount = useMemo(
    () => preview?.candidates.filter((c) => c.importable).length ?? 0,
    [preview],
  );

  const runPreview = async (selected: File) => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const res = await api.importQuadrantAssignments(competitionId, selected, false);
      setPreview(res.preview);
      setSelectedKeys(new Set(res.preview.candidates.filter((c) => c.importable).map((c) => c.key)));
    } catch (e) {
      setError(formatApiError(e, "Error procesando cuadrante"));
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.importQuadrantAssignments(
        competitionId,
        file,
        true,
        [...selectedKeys],
      );
      setResult({ applied: res.applied ?? 0, errors: res.errors ?? [] });
      onApplied(res.assignments ?? {}, res.flags);
    } catch (e) {
      setError(formatApiError(e, "No se pudieron aplicar las asignaciones"));
    } finally {
      setLoading(false);
    }
  };

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
        {result ? "Cerrar" : "Cancelar"}
      </Button>
      {!result && (
        <Button
          type="button"
          onClick={() => void apply()}
          disabled={!preview || selectedCount === 0 || loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Aplicando…
            </>
          ) : (
            `Aplicar (${selectedCount})`
          )}
        </Button>
      )}
    </div>
  );

  return (
    <TransferDialogShell
      open={open}
      onClose={onClose}
      title="Importar cuadrante de jueces"
      subtitle="PDF del cuadrante. Detecta jueces, cruza con directorio y permite elegir qué asignar."
      titleId="quadrant-import-title"
      footer={footer}
    >
      <TransferStepper step={step} />

      <FileDropZone
        kind="schedule"
        file={file}
        onFile={(f) => {
          if (!f) return;
          setFile(f);
          void runPreview(f);
        }}
        disabled={loading || !!result}
        hint="PDF · cuadrante de jueces"
      />

      {loading && !preview && !result ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Procesando cuadrante…
        </div>
      ) : null}

      {error ? (
        <TransferResultBanner variant="error" title="No se pudo importar">
          {error}
        </TransferResultBanner>
      ) : null}

      {result ? (
        <TransferResultBanner variant={result.errors.length ? "error" : "success"} title="Asignaciones aplicadas">
          {result.applied} asignación{result.applied !== 1 ? "es" : ""} aplicada
          {result.errors.length ? ` · ${result.errors.length} error(es)` : ""}.
        </TransferResultBanner>
      ) : null}

      {preview && !result ? (
        <div className="space-y-3 transfer-enter">
          <TransferPreviewStats
            items={[
              { label: "Detectadas", value: preview.detectedCount },
              { label: "Importables", value: importableCount, tone: "success" },
              { label: "Seleccionadas", value: selectedCount, tone: "success" },
              { label: "Páginas", value: preview.pages },
            ]}
          />
          <TransferWarnings warnings={preview.warnings} />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-muted bg-surface/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Preview completa. Revisa roles: los PDFs con columnas pegadas pueden requerir desmarcar filas.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedKeys(
                    new Set(preview.candidates.filter((c) => c.importable).map((c) => c.key)),
                  )
                }
              >
                Seleccionar importables
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedKeys(new Set())}>
                Quitar selección
              </Button>
            </div>
          </div>
          <div className="transfer-preview-scroll rounded-md border border-border">
            <table className="transfer-preview-table w-full text-xs">
              <thead className="text-subtle-muted">
                <tr>
                  <th className="w-10 px-2 py-1.5 text-left">Sel.</th>
                  <th className="px-2 py-1.5 text-left">Sesión</th>
                  <th className="px-2 py-1.5 text-left">Rol</th>
                  <th className="px-2 py-1.5 text-left">Juez</th>
                  <th className="px-2 py-1.5 text-left">Slot</th>
                  <th className="px-2 py-1.5 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {preview.candidates.map((candidate, i) => (
                  <tr
                    key={candidate.key}
                    className="transfer-row-stagger border-t border-border"
                    style={{ animationDelay: `${Math.min(i, 7) * 30}ms` }}
                  >
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border accent-primary disabled:opacity-30"
                        checked={selectedKeys.has(candidate.key)}
                        disabled={!candidate.importable}
                        onChange={() => toggleKey(candidate.key)}
                        aria-label={`Asignar ${candidate.refereeName}`}
                      />
                    </td>
                    <td className="px-2 py-1.5 font-mono text-foreground">{candidate.session}</td>
                    <td className="px-2 py-1.5 text-foreground">{candidate.roleLabel}</td>
                    <td className="px-2 py-1.5 text-foreground">
                      {candidate.refereeName}
                      {candidate.matchedName ? (
                        <span className="ml-1 text-[10px] text-subtle-muted">
                          ({candidate.matchedName})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                      {candidate.slotKey ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-[10.5px] text-subtle-muted">
                      {candidate.reason} · {candidate.confidence}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </TransferDialogShell>
  );
}
