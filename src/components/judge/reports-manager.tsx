"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api/client";
import { selectFieldClass, textareaFieldClass } from "@/lib/design-tokens";
import type { RefereeReport, ReportType } from "@/lib/types";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const REPORT_TYPES: ReportType[] = [
  "Desempeño",
  "Incidencia",
  "Evaluación",
  "Auto-informe",
];

function typeBadge(t: ReportType) {
  if (t === "Incidencia") return <Badge variant="danger">{t}</Badge>;
  if (t === "Evaluación") return <Badge variant="warning">{t}</Badge>;
  if (t === "Auto-informe") return <Badge variant="regional">{t}</Badge>;
  return <Badge variant="success">{t}</Badge>;
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-ES");
}

interface ReportsManagerProps {
  reports: RefereeReport[];
  referees: { id: string; nombre: string }[];
  lockedRefereeId?: string;
  canEdit: boolean;
  canDelete: boolean;
}

export function ReportsManager({
  reports: initialReports,
  referees,
  lockedRefereeId,
  canEdit,
  canDelete,
}: ReportsManagerProps) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const [refereeId, setRefereeId] = useState(lockedRefereeId ?? "");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<ReportType>("Desempeño");
  const [evento, setEvento] = useState("");
  const [contenido, setContenido] = useState("");
  const [adjuntoUrl, setAdjuntoUrl] = useState("");

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const resetForm = () => {
    setTitulo("");
    setTipo("Desempeño");
    setEvento("");
    setContenido("");
    setAdjuntoUrl("");
    if (!lockedRefereeId) setRefereeId("");
  };

  const submit = async () => {
    if (!refereeId || !titulo.trim() || !contenido.trim()) {
      setError("Selecciona un juez y completa título y contenido.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const report = await api.createReport({
        refereeId,
        titulo: titulo.trim(),
        tipo,
        evento: evento.trim() || undefined,
        contenido: contenido.trim(),
        adjuntoUrl: adjuntoUrl.trim() || undefined,
      });
      setReports((prev) => [report, ...prev]);
      resetForm();
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el informe");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api.deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" />
          Informes del juez
          <span className="text-xs font-normal text-subtle-muted">
            ({reports.length})
          </span>
        </CardTitle>
        {canEdit && (
          <Button
            size="sm"
            variant={showForm ? "outline" : "default"}
            className="gap-1.5 rounded-xl"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            {showForm ? "Cancelar" : "Subir informe"}
          </Button>
        )}
      </CardHeader>

      {showForm && canEdit && (
        <div className="space-y-3 border-b border-border-muted bg-surface/50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {!lockedRefereeId && (
              <label className="text-xs">
                <span className="friendly-label mb-1 block">Juez</span>
                <select
                  value={refereeId}
                  onChange={(e) => setRefereeId(e.target.value)}
                  className={selectFieldClass}
                >
                  <option value="">— Seleccionar —</option>
                  {referees.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs">
              <span className="friendly-label mb-1 block">Tipo de informe</span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as ReportType)}
                className={selectFieldClass}
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="friendly-label mb-1 block">Título</span>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Informe de desempeño — Open Nacional"
                className={selectFieldClass}
              />
            </label>
            <label className="text-xs">
              <span className="friendly-label mb-1 block">Evento (opcional)</span>
              <input
                value={evento}
                onChange={(e) => setEvento(e.target.value)}
                placeholder="Campeonato de España 2026"
                className={selectFieldClass}
              />
            </label>
          </div>
          <label className="block text-xs">
            <span className="friendly-label mb-1 block">Contenido del informe</span>
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Redacta aquí el informe del juez…"
              className={textareaFieldClass}
              rows={5}
            />
          </label>
          <label className="block text-xs">
            <span className="friendly-label mb-1 block">
              Enlace a documento adjunto (opcional)
            </span>
            <input
              value={adjuntoUrl}
              onChange={(e) => setAdjuntoUrl(e.target.value)}
              placeholder="https://… (PDF, Drive, etc.)"
              className={selectFieldClass}
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button size="sm" className="rounded-xl" disabled={busy} onClick={submit}>
              {busy ? "Subiendo…" : "Subir informe"}
            </Button>
          </div>
        </div>
      )}

      <CardContent className="divide-y divide-border-muted p-0">
        {reports.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-subtle-muted">
            Sin informes. Usa «Subir informe» para registrar el primero.
          </p>
        )}
        {reports.map((report) => {
          const isOpen = open.has(report.id);
          return (
            <div key={report.id} className="px-4 py-3.5">
              <button
                type="button"
                onClick={() => toggle(report.id)}
                className="flex w-full items-start gap-2 rounded-lg text-left focus-ring"
                aria-expanded={isOpen}
                aria-controls={`report-body-${report.id}`}
              >
                <span className="mt-0.5 shrink-0 text-primary" aria-hidden="true">
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">
                      {report.titulo}
                    </span>
                    {typeBadge(report.tipo)}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-subtle-muted">
                    {!lockedRefereeId && <>{report.refereeName} · </>}
                    {report.autor} · {fmtDate(report.createdAt)}
                    {report.evento ? ` · ${report.evento}` : ""}
                  </span>
                </span>
              </button>
              {isOpen && (
                <div id={`report-body-${report.id}`} className="mt-2 pl-6">
                  <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-foreground-secondary">
                    {report.contenido}
                  </p>
                  {report.adjuntoUrl && (
                    <a
                      href={report.adjuntoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:text-primary-soft"
                    >
                      <Paperclip className="h-3 w-3" />
                      Ver documento adjunto
                    </a>
                  )}
                  {canDelete && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 rounded-lg text-[11.5px] text-subtle-muted hover:text-destructive"
                        disabled={busy}
                        onClick={() => remove(report.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Eliminar informe
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
