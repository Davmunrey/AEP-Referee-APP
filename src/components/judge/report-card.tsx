"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { selectFieldClass, textareaFieldClass } from "@/lib/design-tokens";
import type { RefereeReport, ReportSubjectType, ReportType } from "@/lib/types";
import { ChevronDown, ChevronRight, ExternalLink, Pencil, Trash2 } from "lucide-react";

const REPORT_TYPES: ReportType[] = ["General", "Incidencia", "Evaluación"];

export function typeBadge(t: ReportType, subjectType: ReportSubjectType) {
  if (t === "General" || t === "Competición" || t === "Juez") {
    return <Badge variant={subjectType === "competicion" ? "regional" : "success"}>General</Badge>;
  }
  if (t === "Incidencia") return <Badge variant="danger">{t}</Badge>;
  if (t === "Evaluación") return <Badge variant="warning">{t}</Badge>;
  return <Badge variant="success">General</Badge>;
}

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-ES");
}

interface ReportCardProps {
  report: RefereeReport;
  isOpen: boolean;
  lockedRefereeId?: string;
  canEdit: boolean;
  canDelete: boolean;
  busy: boolean;
  editBusy: boolean;
  editingId: string | null;
  editTitulo: string;
  editTipo: ReportType;
  editEvento: string;
  editContenido: string;
  editAdjuntoUrl: string;
  editError: string | null;
  competitions: { id: string; nombre: string }[];
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onRemove: () => void;
  onEditField: (field: "titulo" | "tipo" | "evento" | "contenido" | "adjuntoUrl", value: string) => void;
}

export function ReportCard({
  report, isOpen, lockedRefereeId, canEdit, canDelete, busy, editBusy,
  editingId, editTitulo, editTipo, editEvento, editContenido, editAdjuntoUrl, editError,
  competitions, onToggle, onStartEdit, onCancelEdit, onSaveEdit, onRemove, onEditField,
}: ReportCardProps) {
  return (
    <div className="px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 rounded-lg text-left focus-ring"
        aria-expanded={isOpen}
        aria-controls={`report-body-${report.id}`}
      >
        <span className="mt-0.5 shrink-0 text-primary" aria-hidden="true">
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">{report.titulo}</span>
            {typeBadge(report.tipo, report.subjectType)}
            {report.adjuntoUrl && (
              <span className="text-primary" aria-label="Tiene documento adjunto" title="Documento adjunto disponible">
                <ExternalLink className="h-3 w-3" />
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-subtle-muted">
            {!lockedRefereeId && report.subjectType === "juez" && report.refereeName && <>{report.refereeName} · </>}
            {!lockedRefereeId && report.subjectType === "competicion" && report.competitionName && <>{report.competitionName} · </>}
            {report.autor} · {fmtDate(report.createdAt)}
            {report.subjectType === "juez" && report.evento ? ` · ${report.evento}` : ""}
          </span>
          {!isOpen && (
            <span className="mt-1 block line-clamp-2 text-[12px] leading-relaxed text-foreground-secondary">
              {report.contenido}
            </span>
          )}
        </span>
      </button>

      {isOpen && (
        <div id={`report-body-${report.id}`} className="mt-2 pl-6">
          {editingId === report.id ? (
            <div className="space-y-2.5 rounded-lg border border-border bg-surface/60 p-3">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="friendly-label mb-1 block">Título</span>
                  <input value={editTitulo} onChange={(e) => onEditField("titulo", e.target.value)} className={selectFieldClass} />
                </label>
                <label className="block text-xs">
                  <span className="friendly-label mb-1 block">Categoría</span>
                  <select value={editTipo} onChange={(e) => onEditField("tipo", e.target.value)} className={selectFieldClass}>
                    {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                {report.subjectType === "juez" && (
                  <label className="block text-xs">
                    <span className="friendly-label mb-1 block">Competición asociada (opcional)</span>
                    <select value={editEvento} onChange={(e) => onEditField("evento", e.target.value)} className={selectFieldClass}>
                      <option value="">— Ninguna —</option>
                      {competitions.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                    </select>
                  </label>
                )}
                <label className="block text-xs">
                  <span className="friendly-label mb-1 block">Enlace adjunto (opcional)</span>
                  <input value={editAdjuntoUrl} onChange={(e) => onEditField("adjuntoUrl", e.target.value)} placeholder="https://…" className={selectFieldClass} />
                </label>
              </div>
              <label className="block text-xs">
                <span className="friendly-label mb-1 block">Contenido</span>
                <textarea value={editContenido} onChange={(e) => onEditField("contenido", e.target.value)} className={textareaFieldClass} rows={4} />
              </label>
              {editError && <p role="alert" className="text-xs text-destructive">{editError}</p>}
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 rounded-lg text-xs" disabled={editBusy} onClick={onSaveEdit}>
                  {editBusy ? "Guardando…" : "Guardar"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" disabled={editBusy} onClick={onCancelEdit}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-foreground-secondary">{report.contenido}</p>
              {report.adjuntoUrl && (
                <a href={report.adjuntoUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[11.5px] font-medium text-primary hover:bg-surface-hover">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver documento adjunto
                </a>
              )}
            </>
          )}
          {editingId !== report.id && (
            <div className="mt-3 flex items-center gap-1">
              {canEdit && (
                <Button size="sm" variant="ghost" className="h-7 gap-1 rounded-lg text-[11.5px] text-subtle-muted hover:text-foreground" disabled={busy || editBusy} onClick={onStartEdit}>
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="ghost" className="h-7 gap-1 rounded-lg text-[11.5px] text-subtle-muted hover:text-destructive" disabled={busy || editBusy} onClick={onRemove}>
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
}
