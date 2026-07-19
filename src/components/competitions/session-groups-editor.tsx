"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { selectFieldClass } from "@/lib/design-tokens";
import type { RosterGrupo } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

interface SessionGroupsEditorProps {
  grupos: RosterGrupo[] | undefined;
  onAddGrupo: () => void;
  onRemoveGrupo: (gi: number) => void;
  onPatchGrupo: (gi: number, patch: Partial<RosterGrupo>) => void;
  onAddGrupoCat: (gi: number) => void;
  onRemoveGrupoCat: (gi: number, ci: number) => void;
  onPatchGrupoCat: (gi: number, ci: number, field: "genero" | "pesos", value: string) => void;
}

export function SessionGroupsEditor({
  grupos, onAddGrupo, onRemoveGrupo, onPatchGrupo, onAddGrupoCat, onRemoveGrupoCat, onPatchGrupoCat,
}: SessionGroupsEditorProps) {
  const list = grupos ?? [];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle-muted">
          Grupos {list.length > 0 ? `(${list.length})` : ""}
        </p>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={onAddGrupo}>
          <Plus className="h-3 w-3" />
          Grupo
        </Button>
      </div>
      {list.map((grupo, gi) => (
        <div key={`${grupo.nombre}-${gi}`} className="space-y-2 rounded-lg border border-border bg-background p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-32"
              value={grupo.nombre}
              onChange={(e) => onPatchGrupo(gi, { nombre: e.target.value })}
              placeholder="Grupo 1"
            />
            <Input
              type="number"
              min={0}
              className="w-20"
              value={grupo.levantadores ?? ""}
              onChange={(e) => onPatchGrupo(gi, { levantadores: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })}
              placeholder="lev."
            />
            <span className="text-xs text-subtle-muted">levantadores</span>
            <Button type="button" variant="ghost" size="sm" className="ml-auto h-6 gap-1 px-2 text-xs" onClick={() => onAddGrupoCat(gi)}>
              <Plus className="h-3 w-3" />
              Cat.
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveGrupo(gi)} aria-label="Eliminar grupo">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
          {grupo.categorias.map((cat, ci) => (
            <div key={ci} className="flex flex-wrap items-center gap-2 pl-2">
              <select
                value={cat.genero}
                onChange={(e) => onPatchGrupoCat(gi, ci, "genero", e.target.value)}
                className={cn(selectFieldClass, "h-8 rounded-lg")}
                aria-label={`Género grupo categoría ${ci + 1}`}
              >
                <option value="Hombres">Hombres</option>
                <option value="Mujeres">Mujeres</option>
              </select>
              <Input
                className="min-w-[8rem] flex-1"
                value={cat.pesos}
                onChange={(e) => onPatchGrupoCat(gi, ci, "pesos", e.target.value)}
                placeholder="Pesos del grupo"
              />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveGrupoCat(gi, ci)} aria-label="Eliminar categoría">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
