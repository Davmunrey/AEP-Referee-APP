"use client";

import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/roster-template";
import type { RoleKey, RosterRole } from "@/lib/types";
import { selectFieldClass } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { Minus, Plus, Trash2 } from "lucide-react";

const ROLE_KEYS = Object.keys(ROLE_LABELS) as RoleKey[];

interface RoleRowsProps {
  title: string;
  accentClass?: string;
  roles: RosterRole[];
  onChange: (idx: number, patch: Partial<RosterRole>) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}

export function RoleRows({ title, accentClass, roles, onChange, onAdd, onRemove }: RoleRowsProps) {
  return (
    <div className="space-y-2">
      <div className={cn("flex items-center justify-between rounded px-2 py-1", accentClass)}>
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle-muted">{title}</p>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={onAdd}>
          <Plus className="h-3 w-3" />
          Rol
        </Button>
      </div>
      {roles.map((role, idx) => (
        <div
          key={`${role.key}-${idx}`}
          className="flex flex-wrap items-center gap-2 rounded border border-border bg-background px-2 py-1.5"
        >
          <select
            value={role.key}
            onChange={(e) => onChange(idx, { key: e.target.value as RoleKey })}
            className={selectFieldClass}
            aria-label="Rol"
          >
            {ROLE_KEYS.map((k) => (
              <option key={k} value={k}>{ROLE_LABELS[k]}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => onChange(idx, { slots: Math.max(1, role.slots - 1) })} disabled={role.slots <= 1} aria-label="Reducir plazas">
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center text-sm font-medium tabular-nums">{role.slots}</span>
            <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => onChange(idx, { slots: Math.min(6, role.slots + 1) })} disabled={role.slots >= 6} aria-label="Aumentar plazas">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <span className="text-[11px] text-subtle-muted">plaza{role.slots !== 1 ? "s" : ""}</span>
          <Button type="button" variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => onRemove(idx)} aria-label={`Eliminar rol ${ROLE_LABELS[role.key]}`}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      {roles.length === 0 && (
        <p className="rounded border border-dashed border-border py-2 text-center text-[11px] text-subtle-muted">
          Sin roles — añade uno
        </p>
      )}
    </div>
  );
}
