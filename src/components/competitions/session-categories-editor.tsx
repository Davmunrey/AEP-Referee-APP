"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectFieldClass } from "@/lib/design-tokens";
import type { RosterCategoria } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

interface SessionCategoriesEditorProps {
  categorias: RosterCategoria[];
  onAdd: () => void;
  onRemove: (ci: number) => void;
  onPatch: (ci: number, field: "genero" | "pesos", value: string) => void;
}

export function SessionCategoriesEditor({ categorias, onAdd, onRemove, onPatch }: SessionCategoriesEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle-muted">Categorías</p>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={onAdd}>
          <Plus className="h-3 w-3" />
          Categoría
        </Button>
      </div>
      {categorias.map((cat, ci) => (
        <div key={ci} className="flex flex-wrap items-center gap-2">
          <select
            value={cat.genero}
            onChange={(e) => onPatch(ci, "genero", e.target.value)}
            className={selectFieldClass}
            aria-label={`Género categoría ${ci + 1}`}
          >
            <option value="Hombres">Hombres</option>
            <option value="Mujeres">Mujeres</option>
          </select>
          <Input
            className="min-w-[8rem] flex-1"
            value={cat.pesos}
            onChange={(e) => onPatch(ci, "pesos", e.target.value)}
            placeholder="Pesos (ej. 59, 66, 74)"
          />
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(ci)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
