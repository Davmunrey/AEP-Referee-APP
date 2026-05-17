"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api/client";
import { selectFieldClass, textareaFieldClass } from "@/lib/design-tokens";
import type {
  ExamResult,
  ExamType,
  RefereeExam,
  RefereeLevel,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Check,
  GraduationCap,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAM_TYPES: ExamType[] = [
  "Teórico",
  "Práctico",
  "Reglamento IPF",
  "Recertificación",
];
const LEVELS: RefereeLevel[] = [
  "Regional",
  "Nacional",
  "IPF Cat. 2",
  "IPF Cat. 1",
];

function resultBadge(r: ExamResult) {
  if (r === "Aprobado") return <Badge variant="success">Aprobado</Badge>;
  if (r === "Suspenso") return <Badge variant="danger">Suspenso</Badge>;
  return <Badge variant="warning">Pendiente</Badge>;
}

interface ExamsManagerProps {
  exams: RefereeExam[];
  referees: { id: string; nombre: string }[];
  lockedRefereeId?: string;
  canEdit: boolean;
  canDelete: boolean;
}

export function ExamsManager({
  exams: initialExams,
  referees,
  lockedRefereeId,
  canEdit,
  canDelete,
}: ExamsManagerProps) {
  const router = useRouter();
  const [exams, setExams] = useState(initialExams);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [refereeId, setRefereeId] = useState(lockedRefereeId ?? "");
  const [tipo, setTipo] = useState<ExamType>("Reglamento IPF");
  const [nivelObjetivo, setNivelObjetivo] = useState<RefereeLevel>("Nacional");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [examinador, setExaminador] = useState("");
  const [puntuacion, setPuntuacion] = useState("");
  const [notas, setNotas] = useState("");

  const resetForm = () => {
    setTipo("Reglamento IPF");
    setNivelObjetivo("Nacional");
    setExaminador("");
    setPuntuacion("");
    setNotas("");
    if (!lockedRefereeId) setRefereeId("");
  };

  const submit = async () => {
    if (!refereeId || !examinador.trim()) {
      setError("Selecciona un juez e indica el examinador.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const exam = await api.createExam({
        refereeId,
        tipo,
        nivelObjetivo,
        fecha,
        examinador: examinador.trim(),
        puntuacion: puntuacion ? Number(puntuacion) : undefined,
        notas: notas.trim() || undefined,
      });
      setExams((prev) => [exam, ...prev]);
      resetForm();
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  const mark = async (id: string, resultado: ExamResult) => {
    setBusy(true);
    try {
      const updated = await api.updateExam(id, { resultado });
      setExams((prev) => prev.map((e) => (e.id === id ? updated : e)));
      router.refresh();
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api.deleteExam(id);
      setExams((prev) => prev.filter((e) => e.id !== id));
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
          <GraduationCap className="h-4 w-4 text-primary" />
          Exámenes arbitrales
          <span className="text-xs font-normal text-subtle-muted">
            ({exams.length})
          </span>
        </CardTitle>
        {canEdit && (
          <Button
            size="sm"
            variant={showForm ? "outline" : "default"}
            className="gap-1.5 rounded-xl"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? "Cancelar" : "Nuevo examen"}
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
              <span className="friendly-label mb-1 block">Tipo de examen</span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as ExamType)}
                className={selectFieldClass}
              >
                {EXAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="friendly-label mb-1 block">Nivel objetivo</span>
              <select
                value={nivelObjetivo}
                onChange={(e) => setNivelObjetivo(e.target.value as RefereeLevel)}
                className={selectFieldClass}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="friendly-label mb-1 block">Fecha</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={selectFieldClass}
              />
            </label>
            <label className="text-xs">
              <span className="friendly-label mb-1 block">Examinador</span>
              <input
                value={examinador}
                onChange={(e) => setExaminador(e.target.value)}
                placeholder="Comité Técnico AEP"
                className={selectFieldClass}
              />
            </label>
            <label className="text-xs">
              <span className="friendly-label mb-1 block">
                Puntuación (0–100, opcional)
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={puntuacion}
                onChange={(e) => setPuntuacion(e.target.value)}
                placeholder="—"
                className={selectFieldClass}
              />
            </label>
          </div>
          <label className="block text-xs">
            <span className="friendly-label mb-1 block">Notas</span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones del examen…"
              className={textareaFieldClass}
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button size="sm" className="rounded-xl" disabled={busy} onClick={submit}>
              {busy ? "Guardando…" : "Registrar examen"}
            </Button>
          </div>
        </div>
      )}

      <CardContent className="divide-y divide-border-muted p-0">
        {exams.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-subtle-muted">
            Sin exámenes registrados.
          </p>
        )}
        {exams.map((exam) => {
          const pct =
            exam.puntuacion != null && exam.puntuacionMaxima > 0
              ? Math.round((exam.puntuacion / exam.puntuacionMaxima) * 100)
              : null;
          return (
            <div key={exam.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-foreground">
                  {exam.tipo}
                </span>
                <Badge variant="muted">→ {exam.nivelObjetivo}</Badge>
                {resultBadge(exam.resultado)}
                <span className="ml-auto font-mono text-[11px] text-subtle-muted">
                  {exam.fecha}
                </span>
              </div>
              {!lockedRefereeId && (
                <p className="mt-1 text-[12px] font-medium text-foreground-secondary">
                  {exam.refereeName}
                </p>
              )}
              <p className="mt-0.5 text-[11.5px] text-subtle-muted">
                Examinador: {exam.examinador}
              </p>
              {pct != null && (
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-active"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Puntuación: ${pct}% (${pct >= 60 ? "aprobado" : "no superado"})`}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full",
                        pct >= 60 ? "bg-success" : "bg-destructive",
                      )}
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-subtle-muted">
                    {exam.puntuacion}/{exam.puntuacionMaxima}
                  </span>
                </div>
              )}
              {exam.notas && (
                <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
                  {exam.notas}
                </p>
              )}
              {(canEdit || canDelete) && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {canEdit && exam.resultado === "Pendiente" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 rounded-lg text-[11.5px]"
                        disabled={busy}
                        onClick={() => mark(exam.id, "Aprobado")}
                      >
                        <Check className="h-3 w-3 text-success" />
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 rounded-lg text-[11.5px]"
                        disabled={busy}
                        onClick={() => mark(exam.id, "Suspenso")}
                      >
                        <X className="h-3 w-3 text-destructive" />
                        Suspender
                      </Button>
                    </>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 rounded-lg text-[11.5px] text-subtle-muted hover:text-destructive"
                      disabled={busy}
                      onClick={() => remove(exam.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Eliminar
                    </Button>
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
