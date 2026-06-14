"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectFieldClass } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, cloneTemplate } from "@/lib/roster-template";
import type { RoleKey, RosterCategoria, RosterGrupo, RosterRole, RosterSession } from "@/lib/types";
import { ChevronDown, ChevronUp, FileUp, Plus, Trash2 } from "lucide-react";
import { ScheduleImportDialog } from "@/components/competitions/schedule-import-dialog";
import { RoleRows, COMPETITION_ROLE_KEYS, PESAJE_ROLE_KEYS } from "@/components/competitions/roster-role-rows";
import { SessionCategoriesEditor } from "@/components/competitions/session-categories-editor";
import { SessionGroupsEditor } from "@/components/competitions/session-groups-editor";

export interface RosterTemplateEditorProps {
  competitionId: string;
  initialTemplate: RosterSession[];
  onSave: (template: RosterSession[]) => void;
  onCancel: () => void;
  saving?: boolean;
}

function nextSessionId(sessions: RosterSession[]): string {
  const nums = sessions.map((s) => parseInt(s.sesion.replace(/\D/g, ""), 10)).filter((n) => !Number.isNaN(n));
  return `S${nums.length ? Math.max(...nums) + 1 : 1}`;
}

// Lunes a domingo (las competiciones suelen ser viernes-domingo, pero dejamos todos).
const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const timeFieldClass =
  "h-9 rounded-xl border border-border-strong bg-surface px-2 text-sm text-foreground focus-ring";

// "10:00 - 13:00" → ["10:00","13:00"], normalizando a HH:MM para <input type=time>.
function parseTimeRange(value: string): [string, string] {
  const norm = (t?: string) => {
    const m = (t ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
    return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : "";
  };
  const parts = value.split(/[–-]/).map((s) => s.trim());
  return [norm(parts[0]), norm(parts[1])];
}

function TimeRangeInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
}) {
  const [start, end] = parseTimeRange(value);
  const set = (s: string, e: string) => onChange(s && e ? `${s} - ${e}` : s || e || "");
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        value={start}
        onChange={(ev) => set(ev.target.value, end)}
        className={timeFieldClass}
        aria-label={`${ariaLabel} — inicio`}
      />
      <span className="text-subtle-muted">–</span>
      <input
        type="time"
        value={end}
        onChange={(ev) => set(start, ev.target.value)}
        className={timeFieldClass}
        aria-label={`${ariaLabel} — fin`}
      />
    </div>
  );
}

export function RosterTemplateEditor({ competitionId, initialTemplate, onSave, onCancel, saving }: RosterTemplateEditorProps) {
  const [sessions, setSessions] = useState(() => cloneTemplate(initialTemplate));
  const [importOpen, setImportOpen] = useState(false);
  const [collapsedIdx, setCollapsedIdx] = useState<Set<number>>(new Set());
  const isDirty = JSON.stringify(sessions) !== JSON.stringify(initialTemplate);

  const handleCancel = () => {
    if (isDirty) {
      const ok = typeof window !== "undefined" && window.confirm("Tienes cambios sin guardar en la plantilla. ¿Descartar y volver a la tarima?");
      if (!ok) return;
    }
    onCancel();
  };

  const toggleCollapse = (idx: number) =>
    setCollapsedIdx((prev) => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });

  const patchSession = (idx: number, patch: Partial<RosterSession>) =>
    setSessions((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const patchCat = (si: number, ci: number, field: "genero" | "pesos", value: string) =>
    setSessions((prev) => prev.map((s, i) => i !== si ? s : { ...s, categorias: s.categorias.map((c, j) => (j === ci ? { ...c, [field]: value } : c)) }));

  const addCat = (si: number) =>
    setSessions((prev) => prev.map((s, i) => i === si ? { ...s, categorias: [...s.categorias, { genero: "Hombres" as const, pesos: "" }] } : s));

  const removeCat = (si: number, ci: number) =>
    setSessions((prev) => prev.map((s, i) => i === si ? { ...s, categorias: s.categorias.filter((_, j) => j !== ci) } : s));

  const patchRole = (si: number, block: "roles" | "pesajeRoles", ri: number, patch: Partial<RosterRole>) =>
    setSessions((prev) => prev.map((s, i) => {
      if (i !== si) return s;
      const list = [...(block === "roles" ? s.roles : s.pesajeRoles)];
      const cur = list[ri]!;
      list[ri] = patch.key ? { ...cur, ...patch, rol: ROLE_LABELS[patch.key] } : { ...cur, ...patch };
      return block === "roles" ? { ...s, roles: list } : { ...s, pesajeRoles: list };
    }));

  const addRole = (si: number, block: "roles" | "pesajeRoles") => {
    const key: RoleKey = block === "pesajeRoles" ? "pesaje" : "central";
    const row: RosterRole = { rol: ROLE_LABELS[key], slots: 1, key };
    setSessions((prev) => prev.map((s, i) => i === si ? (block === "roles" ? { ...s, roles: [...s.roles, row] } : { ...s, pesajeRoles: [...s.pesajeRoles, row] }) : s));
  };

  const removeRole = (si: number, block: "roles" | "pesajeRoles", ri: number) =>
    setSessions((prev) => prev.map((s, i) => {
      if (i !== si) return s;
      return block === "roles" ? { ...s, roles: s.roles.filter((_, j) => j !== ri) } : { ...s, pesajeRoles: s.pesajeRoles.filter((_, j) => j !== ri) };
    }));

  const patchGrupo = (si: number, gi: number, patch: Partial<RosterGrupo>) =>
    setSessions((prev) => prev.map((s, i) => {
      if (i !== si) return s;
      return { ...s, grupos: (s.grupos ?? []).map((g, j) => (j === gi ? { ...g, ...patch } : g)) };
    }));

  const patchGrupoCat = (si: number, gi: number, ci: number, field: "genero" | "pesos", value: string) =>
    setSessions((prev) => prev.map((s, i) => {
      if (i !== si) return s;
      return { ...s, grupos: (s.grupos ?? []).map((g, j) => j !== gi ? g : { ...g, categorias: g.categorias.map((c, k) => (k === ci ? { ...c, [field]: value } : c)) }) };
    }));

  const addGrupo = (si: number) =>
    setSessions((prev) => prev.map((s, i) => {
      if (i !== si) return s;
      const existing = s.grupos ?? [];
      const newGrupo: RosterGrupo = { nombre: `Grupo ${existing.length + 1}`, categorias: [{ genero: "Hombres" as const, pesos: "" } satisfies RosterCategoria], levantadores: undefined };
      return { ...s, grupos: [...existing, newGrupo] };
    }));

  const removeGrupo = (si: number, gi: number) =>
    setSessions((prev) => prev.map((s, i) => {
      if (i !== si) return s;
      const grupos = (s.grupos ?? []).filter((_, j) => j !== gi);
      return { ...s, grupos: grupos.length > 0 ? grupos : undefined };
    }));

  const addGrupoCat = (si: number, gi: number) =>
    setSessions((prev) => prev.map((s, i) => {
      if (i !== si) return s;
      return { ...s, grupos: (s.grupos ?? []).map((g, j) => j === gi ? { ...g, categorias: [...g.categorias, { genero: "Hombres" as const, pesos: "" }] } : g) };
    }));

  const removeGrupoCat = (si: number, gi: number, ci: number) =>
    setSessions((prev) => prev.map((s, i) => {
      if (i !== si) return s;
      return { ...s, grupos: (s.grupos ?? []).map((g, j) => j !== gi ? g : { ...g, categorias: g.categorias.filter((_, k) => k !== ci) }) };
    }));

  const addSession = () => {
    const id = nextSessionId(sessions);
    const last = sessions[sessions.length - 1];
    setSessions((prev) => [...prev, { sesion: id, nombre: `Sesión ${id.slice(1)}`, dia: last?.dia ?? "Nuevo día", categorias: [{ genero: "Hombres", pesos: "" }], horarioCompeticion: "10:00 - 13:00", horarioPesaje: "08:00 - 09:30", roles: [], pesajeRoles: [] }]);
  };

  const removeSession = (idx: number) => {
    if (sessions.length <= 1) return;
    setSessions((prev) => prev.filter((_, i) => i !== idx));
    setCollapsedIdx((prev) => {
      const next = new Set<number>();
      for (const i of prev) { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1); }
      return next;
    });
  };

  const moveSession = (idx: number, dir: -1 | 1) => {
    const t = idx + dir;
    if (t < 0 || t >= sessions.length) return;
    setSessions((prev) => { const n = [...prev]; [n[idx], n[t]] = [n[t]!, n[idx]!]; return n; });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-subtle-muted">Edita sesiones, días, categorías, horarios y roles. Guardar actualiza la plantilla del campeonato.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={saving}>
            <FileUp className="mr-1 h-4 w-4" /> Importar PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addSession}>
            <Plus className="mr-1 h-4 w-4" /> Sesión
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>Cancelar</Button>
          <Button type="button" size="sm" onClick={() => onSave(sessions)} disabled={saving}>
            {saving ? "Guardando…" : "Guardar plantilla"}
          </Button>
        </div>
      </div>

      <ScheduleImportDialog
        competitionId={competitionId}
        open={importOpen}
        hasExistingTemplate={sessions.length > 0}
        onClose={() => setImportOpen(false)}
        onApplied={(tpl) => { setSessions(cloneTemplate(tpl)); setImportOpen(false); }}
      />

      {sessions.map((session, si) => {
        const isCollapsed = collapsedIdx.has(si);
        return (
          <div key={`${session.sesion}-${si}`} className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded p-0.5 text-subtle-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => toggleCollapse(si)}
                aria-expanded={isCollapsed ? "false" : "true"}
                aria-label={isCollapsed ? "Expandir sesión" : "Colapsar sesión"}
              >
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
              <Input className="w-20" value={session.sesion} onChange={(e) => patchSession(si, { sesion: e.target.value })} placeholder="S1" />
              <Input className="min-w-[12rem] flex-1" value={session.nombre} onChange={(e) => patchSession(si, { nombre: e.target.value })} placeholder="Nombre sesión" />
              <select
                className={cn(selectFieldClass, "w-auto min-w-[9rem]")}
                value={session.dia}
                onChange={(e) => patchSession(si, { dia: e.target.value })}
                aria-label="Día de la sesión"
              >
                {!DAYS.includes(session.dia) && session.dia ? (
                  <option value={session.dia}>{session.dia}</option>
                ) : null}
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <div className="ml-auto flex gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSession(si, -1)} disabled={si === 0} aria-label="Subir sesión"><ChevronUp className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSession(si, 1)} disabled={si === sessions.length - 1} aria-label="Bajar sesión"><ChevronDown className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSession(si)} disabled={sessions.length <= 1} aria-label="Eliminar sesión"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="space-y-4 p-4">
                <SessionCategoriesEditor
                  categorias={session.categorias}
                  onAdd={() => addCat(si)}
                  onRemove={(ci) => removeCat(si, ci)}
                  onPatch={(ci, field, value) => patchCat(si, ci, field, value)}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-subtle-muted">Horario competición</span>
                    <TimeRangeInput
                      value={session.horarioCompeticion}
                      onChange={(v) => patchSession(si, { horarioCompeticion: v })}
                      ariaLabel="Horario competición"
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-subtle-muted">Horario pesaje</span>
                    <TimeRangeInput
                      value={session.horarioPesaje}
                      onChange={(v) => patchSession(si, { horarioPesaje: v })}
                      ariaLabel="Horario pesaje"
                    />
                  </div>
                </div>

                <SessionGroupsEditor
                  grupos={session.grupos}
                  onAddGrupo={() => addGrupo(si)}
                  onRemoveGrupo={(gi) => removeGrupo(si, gi)}
                  onPatchGrupo={(gi, patch) => patchGrupo(si, gi, patch)}
                  onAddGrupoCat={(gi) => addGrupoCat(si, gi)}
                  onRemoveGrupoCat={(gi, ci) => removeGrupoCat(si, gi, ci)}
                  onPatchGrupoCat={(gi, ci, field, value) => patchGrupoCat(si, gi, ci, field, value)}
                />

                <div className="grid gap-4 lg:grid-cols-2">
                  <RoleRows
                    title="Jueces · competición"
                    accentClass="bg-surface-active"
                    roles={session.roles}
                    allowedKeys={COMPETITION_ROLE_KEYS}
                    onChange={(ri, patch) => patchRole(si, "roles", ri, patch)}
                    onAdd={() => addRole(si, "roles")}
                    onRemove={(ri) => removeRole(si, "roles", ri)}
                  />
                  <RoleRows
                    title="Pesaje y control de material"
                    accentClass="bg-primary/5"
                    roles={session.pesajeRoles}
                    allowedKeys={PESAJE_ROLE_KEYS}
                    onChange={(ri, patch) => patchRole(si, "pesajeRoles", ri, patch)}
                    onAdd={() => addRole(si, "pesajeRoles")}
                    onRemove={(ri) => removeRole(si, "pesajeRoles", ri)}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
