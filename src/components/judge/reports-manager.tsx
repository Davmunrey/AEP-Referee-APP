"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api/client";
import { selectFieldClass, textareaFieldClass } from "@/lib/design-tokens";
import type { RefereeReport, ReportSubjectType, ReportType } from "@/lib/types";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const REPORT_TYPES: ReportType[] = [
  "Competición",
  "Juez",
  "Incidencia",
  "Evaluación",
];

function typeBadge(t: ReportType) {
  if (t === "Incidencia") return <Badge variant="danger">{t}</Badge>;
  if (t === "Evaluación") return <Badge variant="warning">{t}</Badge>;
  if (t === "Competición") return <Badge variant="regional">{t}</Badge>;
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
  competitions: { id: string; nombre: string }[];
  lockedRefereeId?: string;
  canEdit: boolean;
  canDelete: boolean;
}

export function ReportsManager({
  reports: initialReports,
  referees,
  competitions,
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

  const [subjectType, setSubjectType] = useState<ReportSubjectType>(
    lockedRefereeId ? "juez" : "competicion",
  );
  const [refereeId, setRefereeId] = useState(lockedRefereeId ?? "");
  const [competitionId, setCompetitionId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<ReportType>("Competición");
  const [evento, setEvento] = useState("");
  const [contenido, setContenido] = useState("");
  const [adjuntoUrl, setAdjuntoUrl] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editTipo, setEditTipo] = useState<ReportType>("Competición");
  const [editEvento, setEditEvento] = useState("");
  const [editContenido, setEditContenido] = useState("");
  const [editAdjuntoUrl, setEditAdjuntoUrl] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const resetForm = () => {
    setTitulo("");
    setTipo("Competición");
    setEvento("");
    setContenido("");
    setAdjuntoUrl("");
    setCompetitionId("");
    if (!lockedRefereeId) setSubjectType("competicion");
    if (!lockedRefereeId) setRefereeId("");
  };

  const submit = async () => {
    if (!titulo.trim() || !contenido.trim()) {
      setError("Completa título y contenido.");
      return;
    }
    if (subjectType === "juez" && !refereeId) {
      setError("Selecciona juez.");
      return;
    }
    if (subjectType === "competicion" && !competitionId) {
      setError("Selecciona competición.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const report = await api.createReport({
        subjectType,
        refereeId: subjectType === "juez" ? refereeId : undefined,
        competitionId: subjectType === "competicion" ? competitionId : undefined,
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

  const startEdit = (report: RefereeReport) => {
    setEditingId(report.id);
    setEditTitulo(report.titulo);
    setEditTipo(report.tipo);
    setEditEvento(report.evento ?? "");
    setEditContenido(report.contenido);
    setEditAdjuntoUrl(report.adjuntoUrl ?? "");
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const saveEdit = async (reportId: string) => {
    if (!editTitulo.trim() || !editContenido.trim()) {
      setEditError("Título y contenido son obligatorios.");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const updated = await api.updateReport(reportId, {
        titulo: editTitulo.trim(),
        tipo: editTipo,
        evento: editEvento.trim() || undefined,
        contenido: editContenido.trim(),
        adjuntoUrl: editAdjuntoUrl.trim() || undefined,
      });
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setEditBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" />
          Informes
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
                <span className="friendly-label mb-1 block">Ámbito</span>
                <select
                  value={subjectType}
                  onChange={(e) => setSubjectType(e.target.value as ReportSubjectType)}
                  className={selectFieldClass}
                >
                  <option value="competicion">Competición</option>
                  <option value="juez">Juez</option>
                </select>
              </label>
            )}
            {subjectType === "juez" && !lockedRefereeId && (
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
            {subjectType === "competicion" && (
              <label className="text-xs">
                <span className="friendly-label mb-1 block">Competición</span>
                <select
                  value={competitionId}
                  onChange={(e) => setCompetitionId(e.target.value)}
                  className={selectFieldClass}
                >
                  <option value="">— Seleccionar —</option>
                  {competitions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
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
                placeholder="Informe de competición — Open Nacional"
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

      <CardContent className="p-0">
        {reports.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <FileText className="h-10 w-10 text-border-strong" />
          <div>
            <p className="text-sm font-medium text-foreground-secondary">
              Sin informes registrados
            </p>
              <p className="mt-0.5 text-xs text-subtle-muted">
                {canEdit
                  ? "Usa «Subir informe» para registrar el primero."
                  : "Aún no hay informes en el historial."}
              </p>
            </div>
          </div>
        )}

        <div className="divide-y divide-border-muted">
          {reports.map((report) => {
            const isOpen = open.has(report.id);
            return (
              <div key={report.id} className="px-4 py-3">
                {/* Report card header — always visible */}
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
                      {report.adjuntoUrl && (
                        <span
                          className="text-primary"
                          aria-label="Tiene documento adjunto"
                          title="Documento adjunto disponible"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-subtle-muted">
                      {!lockedRefereeId && report.subjectType === "juez" && report.refereeName && (
                        <>{report.refereeName} · </>
                      )}
                      {!lockedRefereeId && report.subjectType === "competicion" && report.competitionName && (
                        <>{report.competitionName} · </>
                      )}
                      {report.autor} · {fmtDate(report.createdAt)}
                      {report.evento ? ` · ${report.evento}` : ""}
                    </span>
                    {/* Content preview when collapsed */}
                    {!isOpen && (
                      <span className="mt-1 block line-clamp-2 text-[12px] leading-relaxed text-foreground-secondary">
                        {report.contenido}
                      </span>
                    )}
                  </span>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div id={`report-body-${report.id}`} className="mt-2 pl-6">
                    {editingId === report.id ? (
                      /* ── Inline edit form ── */
                      <div className="space-y-2.5 rounded-lg border border-border bg-surface/60 p-3">
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <label className="block text-xs">
                            <span className="friendly-label mb-1 block">Título</span>
                            <input
                              value={editTitulo}
                              onChange={(e) => setEditTitulo(e.target.value)}
                              className={selectFieldClass}
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="friendly-label mb-1 block">Tipo</span>
                            <select
                              value={editTipo}
                              onChange={(e) => setEditTipo(e.target.value as ReportType)}
                              className={selectFieldClass}
                            >
                              {REPORT_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-xs">
                            <span className="friendly-label mb-1 block">Evento (opcional)</span>
                            <input
                              value={editEvento}
                              onChange={(e) => setEditEvento(e.target.value)}
                              placeholder="Campeonato de España 2026"
                              className={selectFieldClass}
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="friendly-label mb-1 block">Enlace adjunto (opcional)</span>
                            <input
                              value={editAdjuntoUrl}
                              onChange={(e) => setEditAdjuntoUrl(e.target.value)}
                              placeholder="https://…"
                              className={selectFieldClass}
                            />
                          </label>
                        </div>
                        <label className="block text-xs">
                          <span className="friendly-label mb-1 block">Contenido</span>
                          <textarea
                            value={editContenido}
                            onChange={(e) => setEditContenido(e.target.value)}
                            className={textareaFieldClass}
                            rows={4}
                          />
                        </label>
                        {editError && (
                          <p role="alert" className="text-xs text-destructive">{editError}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 rounded-lg text-xs"
                            disabled={editBusy}
                            onClick={() => void saveEdit(report.id)}
                          >
                            {editBusy ? "Guardando…" : "Guardar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-lg text-xs"
                            disabled={editBusy}
                            onClick={cancelEdit}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ── Normal view ── */
                      <>
                        <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-foreground-secondary">
                          {report.contenido}
                        </p>
                        {report.adjuntoUrl && (
                          <a
                            href={report.adjuntoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[11.5px] font-medium text-primary hover:bg-surface-hover"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver documento adjunto
                          </a>
                        )}
                      </>
                    )}
                    {editingId !== report.id && (
                      <div className="mt-3 flex items-center gap-1">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 rounded-lg text-[11.5px] text-subtle-muted hover:text-foreground"
                            disabled={busy || editBusy}
                            onClick={() => startEdit(report)}
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 rounded-lg text-[11.5px] text-subtle-muted hover:text-destructive"
                            disabled={busy || editBusy}
                            onClick={() => remove(report.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                            Eliminar informe
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
