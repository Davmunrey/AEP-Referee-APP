"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, cloneTemplate, defaultPesajeRoles } from "@/lib/roster-template";
import { COMPETICION_ROLES_AEP1, COMPETICION_ROLES_AEP2 } from "@/lib/mock-data";
import type {
  EventType,
  RoleKey,
  RosterCategoria,
  RosterGrupo,
  RosterRole,
  RosterSession,
} from "@/lib/types";
import { selectFieldClass } from "@/lib/design-tokens";
import { ChevronDown, ChevronUp, FileUp, Plus, Trash2 } from "lucide-react";
import { ScheduleImportDialog } from "@/components/events/schedule-import-dialog";

const ROLE_KEYS = Object.keys(ROLE_LABELS) as RoleKey[];

export interface RosterTemplateEditorProps {
  eventId: string;
  eventType: EventType;
  initialTemplate: RosterSession[];
  onSave: (template: RosterSession[]) => void;
  onCancel: () => void;
  saving?: boolean;
}

function nextSessionId(sessions: RosterSession[]): string {
  const nums = sessions
    .map((s) => parseInt(s.sesion.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return `S${nums.length ? Math.max(...nums) + 1 : 1}`;
}

function defaultRolesForType(tipo: EventType): RosterRole[] {
  const src = tipo === "AEP-1" ? COMPETICION_ROLES_AEP1 : COMPETICION_ROLES_AEP2;
  return src.map((r) => ({ ...r }));
}

function RoleRows({
  title,
  roles,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  roles: RosterRole[];
  onChange: (idx: number, patch: Partial<RosterRole>) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-subtle-muted">{title}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-3 w-3" />
          Rol
        </Button>
      </div>
      {roles.map((role, idx) => (
        <div key={`${role.key}-${idx}`} className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
          <select
            value={role.key}
            onChange={(e) => onChange(idx, { key: e.target.value as RoleKey })}
            className={selectFieldClass}
          >
            {ROLE_KEYS.map((k) => (
              <option key={k} value={k}>
                {ROLE_LABELS[k]}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={1}
            max={6}
            className="w-16"
            value={role.slots}
            onChange={(e) => onChange(idx, { slots: Math.max(1, Number(e.target.value) || 1) })}
          />
          <span className="text-xs text-subtle-muted">plazas</span>
          <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(idx)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function RosterTemplateEditor({
  eventId,
  eventType,
  initialTemplate,
  onSave,
  onCancel,
  saving,
}: RosterTemplateEditorProps) {
  const [sessions, setSessions] = useState(() => cloneTemplate(initialTemplate));
  const [importOpen, setImportOpen] = useState(false);

  const patchSession = (idx: number, patch: Partial<RosterSession>) => {
    setSessions((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const patchCat = (
    si: number,
    ci: number,
    field: "genero" | "pesos",
    value: string,
  ) => {
    setSessions((prev) =>
      prev.map((s, i) =>
        i !== si
          ? s
          : {
              ...s,
              categorias: s.categorias.map((c, j) =>
                j === ci ? { ...c, [field]: value } : c,
              ),
            },
      ),
    );
  };

  const addCat = (si: number) => {
    setSessions((prev) =>
      prev.map((s, i) =>
        i === si
          ? { ...s, categorias: [...s.categorias, { genero: "Hombres" as const, pesos: "" }] }
          : s,
      ),
    );
  };

  const removeCat = (si: number, ci: number) => {
    setSessions((prev) =>
      prev.map((s, i) =>
        i === si ? { ...s, categorias: s.categorias.filter((_, j) => j !== ci) } : s,
      ),
    );
  };

  const patchRole = (
    si: number,
    block: "roles" | "pesajeRoles",
    ri: number,
    patch: Partial<RosterRole>,
  ) => {
    setSessions((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const list = [...(block === "roles" ? s.roles : s.pesajeRoles)];
        const cur = list[ri]!;
        list[ri] = patch.key
          ? { ...cur, ...patch, rol: ROLE_LABELS[patch.key] }
          : { ...cur, ...patch };
        return block === "roles" ? { ...s, roles: list } : { ...s, pesajeRoles: list };
      }),
    );
  };

  const addRole = (si: number, block: "roles" | "pesajeRoles") => {
    const key: RoleKey = block === "pesajeRoles" ? "pesaje" : "central";
    const row: RosterRole = { rol: ROLE_LABELS[key], slots: 1, key };
    setSessions((prev) =>
      prev.map((s, i) =>
        i === si
          ? block === "roles"
            ? { ...s, roles: [...s.roles, row] }
            : { ...s, pesajeRoles: [...s.pesajeRoles, row] }
          : s,
      ),
    );
  };

  const removeRole = (si: number, block: "roles" | "pesajeRoles", ri: number) => {
    setSessions((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        return block === "roles"
          ? { ...s, roles: s.roles.filter((_, j) => j !== ri) }
          : { ...s, pesajeRoles: s.pesajeRoles.filter((_, j) => j !== ri) };
      }),
    );
  };

  const patchGrupo = (
    si: number,
    gi: number,
    patch: Partial<RosterGrupo>,
  ) => {
    setSessions((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const grupos = (s.grupos ?? []).map((g, j) => (j === gi ? { ...g, ...patch } : g));
        return { ...s, grupos };
      }),
    );
  };

  const patchGrupoCat = (
    si: number,
    gi: number,
    ci: number,
    field: "genero" | "pesos",
    value: string,
  ) => {
    setSessions((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const grupos = (s.grupos ?? []).map((g, j) =>
          j !== gi
            ? g
            : {
                ...g,
                categorias: g.categorias.map((c, k) =>
                  k === ci ? { ...c, [field]: value } : c,
                ),
              },
        );
        return { ...s, grupos };
      }),
    );
  };

  const addGrupo = (si: number) => {
    setSessions((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const existing = s.grupos ?? [];
        const nombre = `Grupo ${existing.length + 1}`;
        const newGrupo: RosterGrupo = {
          nombre,
          categorias: [{ genero: "Hombres" as const, pesos: "" } satisfies RosterCategoria],
          levantadores: undefined,
        };
        return { ...s, grupos: [...existing, newGrupo] };
      }),
    );
  };

  const removeGrupo = (si: number, gi: number) => {
    setSessions((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const grupos = (s.grupos ?? []).filter((_, j) => j !== gi);
        return { ...s, grupos: grupos.length > 0 ? grupos : undefined };
      }),
    );
  };

  const addGrupoCat = (si: number, gi: number) => {
    setSessions((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const grupos = (s.grupos ?? []).map((g, j) =>
          j === gi
            ? { ...g, categorias: [...g.categorias, { genero: "Hombres" as const, pesos: "" }] }
            : g,
        );
        return { ...s, grupos };
      }),
    );
  };

  const removeGrupoCat = (si: number, gi: number, ci: number) => {
    setSessions((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const grupos = (s.grupos ?? []).map((g, j) =>
          j !== gi ? g : { ...g, categorias: g.categorias.filter((_, k) => k !== ci) },
        );
        return { ...s, grupos };
      }),
    );
  };

  const addSession = () => {
    const id = nextSessionId(sessions);
    const last = sessions[sessions.length - 1];
    setSessions((prev) => [
      ...prev,
      {
        sesion: id,
        nombre: `Sesión ${id.slice(1)}`,
        dia: last?.dia ?? "Nuevo día",
        categorias: [{ genero: "Hombres", pesos: "" }],
        horarioCompeticion: "10:00 - 13:00",
        horarioPesaje: "08:00 - 09:30",
        roles: defaultRolesForType(eventType),
        pesajeRoles: defaultPesajeRoles(),
      },
    ]);
  };

  const removeSession = (idx: number) => {
    if (sessions.length <= 1) return;
    setSessions((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveSession = (idx: number, dir: -1 | 1) => {
    const t = idx + dir;
    if (t < 0 || t >= sessions.length) return;
    setSessions((prev) => {
      const n = [...prev];
      [n[idx], n[t]] = [n[t]!, n[idx]!];
      return n;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-subtle-muted">
          Edita sesiones, días, categorías, horarios y roles. Guardar actualiza la plantilla del evento.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            disabled={saving}
          >
            <FileUp className="mr-1 h-4 w-4" />
            Importar PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addSession}>
            <Plus className="mr-1 h-4 w-4" />
            Sesión
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={() => onSave(sessions)} disabled={saving}>
            {saving ? "Guardando…" : "Guardar plantilla"}
          </Button>
        </div>
      </div>

      <ScheduleImportDialog
        eventId={eventId}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onApplied={(tpl) => {
          setSessions(cloneTemplate(tpl));
          setImportOpen(false);
        }}
      />

      {sessions.map((session, si) => (
        <div
          key={`${session.sesion}-${si}`}
          className="rounded-lg border border-border bg-surface p-4 space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Input
                className="w-20"
                value={session.sesion}
                onChange={(e) => patchSession(si, { sesion: e.target.value })}
                placeholder="S1"
              />
              <Input
                className="min-w-[12rem] flex-1"
                value={session.nombre}
                onChange={(e) => patchSession(si, { nombre: e.target.value })}
                placeholder="Nombre sesión"
              />
              <Input
                className="min-w-[10rem]"
                value={session.dia}
                onChange={(e) => patchSession(si, { dia: e.target.value })}
                placeholder="Día"
              />
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => moveSession(si, -1)} disabled={si === 0}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => moveSession(si, 1)}
                disabled={si === sessions.length - 1}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSession(si)}
                disabled={sessions.length <= 1}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle-muted">Categorías</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => addCat(si)}>
                <Plus className="mr-1 h-3 w-3" />
                Categoría
              </Button>
            </div>
            {session.categorias.map((cat, ci) => (
              <div key={ci} className="flex flex-wrap items-center gap-2">
                <select
                  value={cat.genero}
                  onChange={(e) =>
                    patchCat(si, ci, "genero", e.target.value as "Hombres" | "Mujeres")
                  }
                  className={selectFieldClass}
                >
                  <option value="Hombres">Hombres</option>
                  <option value="Mujeres">Mujeres</option>
                </select>
                <Input
                  className="flex-1 min-w-[8rem]"
                  value={cat.pesos}
                  onChange={(e) => patchCat(si, ci, "pesos", e.target.value)}
                  placeholder="Pesos (ej. 59, 66, 74)"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeCat(si, ci)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-subtle-muted">Horario competición</span>
              <Input
                value={session.horarioCompeticion}
                onChange={(e) => patchSession(si, { horarioCompeticion: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-subtle-muted">Horario pesaje</span>
              <Input
                value={session.horarioPesaje}
                onChange={(e) => patchSession(si, { horarioPesaje: e.target.value })}
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle-muted">
                Grupos {session.grupos && session.grupos.length > 0 ? `(${session.grupos.length})` : ""}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={() => addGrupo(si)}>
                <Plus className="mr-1 h-3 w-3" />
                Grupo
              </Button>
            </div>
            {(session.grupos ?? []).map((grupo, gi) => (
              <div
                key={`${grupo.nombre}-${gi}`}
                className="space-y-2 rounded border border-border p-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="w-32"
                    value={grupo.nombre}
                    onChange={(e) => patchGrupo(si, gi, { nombre: e.target.value })}
                    placeholder="Grupo 1"
                  />
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={grupo.levantadores ?? ""}
                    onChange={(e) =>
                      patchGrupo(si, gi, {
                        levantadores: e.target.value ? Math.max(0, Number(e.target.value)) : undefined,
                      })
                    }
                    placeholder="lev."
                  />
                  <span className="text-xs text-subtle-muted">levantadores</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => addGrupoCat(si, gi)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Categoría
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGrupo(si, gi)}
                    aria-label="Eliminar grupo"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                {grupo.categorias.map((cat, ci) => (
                  <div key={ci} className="flex flex-wrap items-center gap-2 pl-2">
                    <select
                      value={cat.genero}
                      onChange={(e) =>
                        patchGrupoCat(si, gi, ci, "genero", e.target.value)
                      }
                      className={selectFieldClass}
                    >
                      <option value="Hombres">Hombres</option>
                      <option value="Mujeres">Mujeres</option>
                    </select>
                    <Input
                      className="flex-1 min-w-[8rem]"
                      value={cat.pesos}
                      onChange={(e) => patchGrupoCat(si, gi, ci, "pesos", e.target.value)}
                      placeholder="Pesos del grupo"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGrupoCat(si, gi, ci)}
                      aria-label="Eliminar categoría"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <RoleRows
            title="Roles competición"
            roles={session.roles}
            onChange={(ri, patch) => patchRole(si, "roles", ri, patch)}
            onAdd={() => addRole(si, "roles")}
            onRemove={(ri) => removeRole(si, "roles", ri)}
          />
          <RoleRows
            title="Roles pesaje"
            roles={session.pesajeRoles}
            onChange={(ri, patch) => patchRole(si, "pesajeRoles", ri, patch)}
            onAdd={() => addRole(si, "pesajeRoles")}
            onRemove={(ri) => removeRole(si, "pesajeRoles", ri)}
          />
        </div>
      ))}
    </div>
  );
}
