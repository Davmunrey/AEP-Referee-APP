"use client";

import { Button } from "@/components/ui/button";
import { selectFieldClass } from "@/lib/design-tokens";
import type { RosterCategoria } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Plus, Trash2, X } from "lucide-react";

interface SessionCategoriesEditorProps {
  categorias: RosterCategoria[];
  onAdd: () => void;
  onRemove: (ci: number) => void;
  onPatch: (ci: number, field: "genero" | "pesos", value: string) => void;
}

// Categorías de peso AEP/IPF por género (fuente: aep-guide-2026). Permiten elegir
// las categorías con un clic en vez de escribirlas a mano.
const WEIGHT_CLASSES: Record<string, string[]> = {
  Hombres: ["-59", "-66", "-74", "-83", "-93", "-105", "-120", "+120"],
  Mujeres: ["-47", "-52", "-57", "-63", "-69", "-76", "-84", "+84"],
};

const parseTokens = (pesos: string): string[] =>
  pesos.split(",").map((t) => t.trim()).filter(Boolean);

export function SessionCategoriesEditor({ categorias, onAdd, onRemove, onPatch }: SessionCategoriesEditorProps) {
  const toggleWeight = (ci: number, cat: RosterCategoria, weight: string) => {
    const tokens = new Set(parseTokens(cat.pesos));
    if (tokens.has(weight)) tokens.delete(weight);
    else tokens.add(weight);
    const catalog = WEIGHT_CLASSES[cat.genero] ?? [];
    const ordered = catalog.filter((c) => tokens.has(c));
    const customs = [...tokens].filter((t) => !catalog.includes(t));
    onPatch(ci, "pesos", [...ordered, ...customs].join(", "));
  };

  const removeCustom = (ci: number, cat: RosterCategoria, token: string) => {
    const tokens = parseTokens(cat.pesos).filter((t) => t !== token);
    onPatch(ci, "pesos", tokens.join(", "));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle-muted">Categorías</p>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={onAdd}>
          <Plus className="h-3 w-3" />
          Categoría
        </Button>
      </div>
      {categorias.map((cat, ci) => {
        const tokens = parseTokens(cat.pesos);
        const catalog = WEIGHT_CLASSES[cat.genero] ?? [];
        const customs = tokens.filter((t) => !catalog.includes(t));
        return (
          <div key={ci} className="flex items-start gap-2 rounded-lg border border-border bg-background px-2 py-2">
            <select
              value={cat.genero}
              onChange={(e) => onPatch(ci, "genero", e.target.value)}
              className={cn(selectFieldClass, "w-28 shrink-0")}
              aria-label={`Género categoría ${ci + 1}`}
            >
              <option value="Hombres">Hombres</option>
              <option value="Mujeres">Mujeres</option>
            </select>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {catalog.map((w) => {
                const active = tokens.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleWeight(ci, cat, w)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-mono text-[11px] tabular-nums transition-colors focus-ring",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    {w}
                  </button>
                );
              })}
              {customs.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-muted px-2 py-1 text-[11px] text-warning"
                  title="Valor libre (no es una categoría estándar)"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeCustom(ci, cat, t)}
                    aria-label={`Quitar ${t}`}
                    className="rounded-full hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onRemove(ci)} aria-label={`Eliminar categoría ${ci + 1}`}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
