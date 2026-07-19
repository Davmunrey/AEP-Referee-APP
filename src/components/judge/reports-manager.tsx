"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { selectFieldClass, textareaFieldClass } from "@/lib/design-tokens";
import type { RefereeReport, ReportSubjectType, ReportType } from "@/lib/types";
import { FileText, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ReportCard } from "./report-card";

const REPORT_TYPES: ReportType[] = ["General", "Incidencia", "Evaluación"];

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

  // Re-sincroniza con los datos del servidor tras router.refresh() (mismo
  // patrón que competitions-table). Solo toca la lista, no los formularios.
  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const [subjectType, setSubjectType] = useState<ReportSubjectType>(lockedRefereeId ? "juez" : "competicion");
  const [refereeId, setRefereeId] = useState(lockedRefereeId ?? "");
  const [competitionId, setCompetitionId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<ReportType>("General");
  const [evento, setEvento] = useState("");
  const [contenido, setContenido] = useState("");
  const [adjuntoUrl, setAdjuntoUrl] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editTipo, setEditTipo] = useState<ReportType>("General");
  const [editEvento, setEditEvento] = useState("");
  const [editContenido, setEditContenido] = useState("");
  const [editAdjuntoUrl, setEditAdjuntoUrl] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const resetForm = () => {
    setTitulo(""); setTipo("General"); setEvento(""); setContenido(""); setAdjuntoUrl(""); setCompetitionId("");
    if (!lockedRefereeId) { setSubjectType("competicion"); setRefereeId(""); }
  };

  const submit = async () => {
    if (!titulo.trim() || !contenido.trim()) { setError("Completa título y contenido."); return; }
    if (subjectType === "juez" && !refereeId) { setError("Selecciona juez."); return; }
    if (subjectType === "competicion" && !competitionId) { setError("Selecciona competición."); return; }
    setBusy(true); setError(null);
    try {
      const report = await api.createReport({
        subjectType,
        refereeId: subjectType === "juez" ? refereeId : undefined,
        competitionId: subjectType === "competicion" ? competitionId : undefined,
        titulo: titulo.trim(), tipo,
        evento: subjectType === "juez" ? evento.trim() || undefined : undefined,
        contenido: contenido.trim(),
        adjuntoUrl: adjuntoUrl.trim() || undefined,
      });
      setReports((prev) => [report, ...prev]);
      resetForm(); setShowForm(false); router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el informe");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm("¿Eliminar este informe? Esta acción no se puede deshacer.")) return;
    setBusy(true);
    setError(null);
    try { await api.deleteReport(id); setReports((prev) => prev.filter((r) => r.id !== id)); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo eliminar el informe"); }
    finally { setBusy(false); }
  };

  const startEdit = (report: RefereeReport) => {
    setEditingId(report.id); setEditTitulo(report.titulo); setEditTipo(report.tipo);
    setEditEvento(report.evento ?? ""); setEditContenido(report.contenido); setEditAdjuntoUrl(report.adjuntoUrl ?? ""); setEditError(null);
  };

  const saveEdit = async (reportId: string) => {
    if (!editTitulo.trim() || !editContenido.trim()) { setEditError("Título y contenido son obligatorios."); return; }
    setEditBusy(true); setEditError(null);
    try {
      const updated = await api.updateReport(reportId, {
        titulo: editTitulo.trim(), tipo: editTipo,
        evento: reports.find((r) => r.id === reportId)?.subjectType === "juez" ? editEvento.trim() || undefined : undefined,
        contenido: editContenido.trim(), adjuntoUrl: editAdjuntoUrl.trim() || undefined,
      });
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      setEditingId(null); router.refresh();
    } catch (err) { setEditError(err instanceof Error ? err.message : "Error al guardar"); }
    finally { setEditBusy(false); }
  };

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border-muted py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" />
          Informes
          <span className="text-xs font-normal text-subtle-muted">({reports.length})</span>
        </CardTitle>
        {canEdit && (
          <Button size="sm" variant={showForm ? "outline" : "default"} className="gap-1.5 rounded-xl" onClick={() => setShowForm((v) => !v)}>
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
                <select value={subjectType} onChange={(e) => { const next = e.target.value as ReportSubjectType; setSubjectType(next); setEvento(""); if (next === "competicion") setRefereeId(""); if (next === "juez") setCompetitionId(""); }} className={selectFieldClass}>
                  <option value="competicion">Competición</option>
                  <option value="juez">Juez</option>
                </select>
              </label>
            )}
            {subjectType === "juez" && !lockedRefereeId && (
              <label className="text-xs">
                <span className="friendly-label mb-1 block">Juez</span>
                <select value={refereeId} onChange={(e) => setRefereeId(e.target.value)} className={selectFieldClass}>
                  <option value="">— Seleccionar —</option>
                  {referees.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </label>
            )}
            {subjectType === "competicion" && (
              <label className="text-xs">
                <span className="friendly-label mb-1 block">Competición</span>
                <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} className={selectFieldClass}>
                  <option value="">— Seleccionar —</option>
                  {competitions.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
            )}
            <label className="text-xs">
              <span className="friendly-label mb-1 block">Categoría</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as ReportType)} className={selectFieldClass}>
                {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-xs">
              <span className="friendly-label mb-1 block">Título</span>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={subjectType === "competicion" ? "Informe general de competición" : "Informe general de juez"} className={selectFieldClass} />
            </label>
            {subjectType === "juez" && (
              <label className="text-xs">
                <span className="friendly-label mb-1 block">Competición asociada (opcional)</span>
                <select value={evento} onChange={(e) => setEvento(e.target.value)} className={selectFieldClass}>
                  <option value="">— Ninguna —</option>
                  {competitions.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </label>
            )}
          </div>
          <label className="block text-xs">
            <span className="friendly-label mb-1 block">Contenido del informe</span>
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder={subjectType === "competicion" ? "Redacta aquí el informe de la competición…" : "Redacta aquí el informe del juez…"} className={textareaFieldClass} rows={5} />
          </label>
          <label className="block text-xs">
            <span className="friendly-label mb-1 block">Enlace a documento adjunto (opcional)</span>
            <input value={adjuntoUrl} onChange={(e) => setAdjuntoUrl(e.target.value)} placeholder="https://… (PDF, Drive, etc.)" className={selectFieldClass} />
          </label>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button size="sm" className="rounded-xl" disabled={busy} onClick={() => void submit()}>
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
              <p className="text-sm font-medium text-foreground-secondary">Sin informes registrados</p>
              <p className="mt-0.5 text-xs text-subtle-muted">{canEdit ? "Usa «Subir informe» para registrar el primero." : "Aún no hay informes en el historial."}</p>
            </div>
          </div>
        )}
        <div className="divide-y divide-border-muted">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              isOpen={open.has(report.id)}
              lockedRefereeId={lockedRefereeId}
              canEdit={canEdit}
              canDelete={canDelete}
              busy={busy}
              editBusy={editBusy}
              editingId={editingId}
              editTitulo={editTitulo}
              editTipo={editTipo}
              editEvento={editEvento}
              editContenido={editContenido}
              editAdjuntoUrl={editAdjuntoUrl}
              editError={editError}
              competitions={competitions}
              onToggle={() => toggle(report.id)}
              onStartEdit={() => startEdit(report)}
              onCancelEdit={() => { setEditingId(null); setEditError(null); }}
              onSaveEdit={() => void saveEdit(report.id)}
              onRemove={() => void remove(report.id)}
              onEditField={(field, value) => {
                if (field === "titulo") setEditTitulo(value);
                else if (field === "tipo") setEditTipo(value as ReportType);
                else if (field === "evento") setEditEvento(value);
                else if (field === "contenido") setEditContenido(value);
                else if (field === "adjuntoUrl") setEditAdjuntoUrl(value);
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
