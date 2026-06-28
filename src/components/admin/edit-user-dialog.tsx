"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectFieldClass } from "@/lib/design-tokens";
import { ROLE_LABELS } from "@/lib/types";
import type { UserRole } from "@/lib/types";
import { Loader2 } from "lucide-react";

export interface EditFormState {
  nombre: string;
  rolLabel: string;
  role: UserRole;
  zona: string;
}

interface EditUserDialogProps {
  email: string;
  form: EditFormState;
  error: string | null;
  saving: boolean;
  zones: { code: string; name: string }[];
  onFormChange: (patch: Partial<EditFormState>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function EditUserDialog({
  email,
  form,
  error,
  saving,
  zones,
  onFormChange,
  onSubmit,
  onClose,
}: EditUserDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border-strong bg-card p-6 shadow-xl">
        <h3 id="edit-user-title" className="text-base font-semibold text-foreground">
          Editar usuario
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{email}</p>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3">
          <Input
            placeholder="Nombre completo"
            value={form.nombre}
            onChange={(e) => onFormChange({ nombre: e.target.value })}
            required
          />
          <Input
            placeholder="Etiqueta de rol (ej. Resp. Cataluña)"
            value={form.rolLabel}
            onChange={(e) => onFormChange({ rolLabel: e.target.value })}
            required
          />
          <select
            className={selectFieldClass}
            value={form.role}
            aria-label="Rol"
            onChange={(e) => onFormChange({ role: e.target.value as UserRole })}
          >
            <option value="super_admin">{ROLE_LABELS.super_admin}</option>
            <option value="delegado_jueces">{ROLE_LABELS.delegado_jueces}</option>
            <option value="delegado_zona">{ROLE_LABELS.delegado_zona}</option>
            <option value="responsable_financiero_jueces">
              {ROLE_LABELS.responsable_financiero_jueces}
            </option>
            <option value="solo_ver">{ROLE_LABELS.solo_ver}</option>
          </select>
          {form.role === "delegado_zona" && (
            <select
              className={selectFieldClass}
              value={form.zona}
              aria-label="Zona"
              onChange={(e) => onFormChange({ zona: e.target.value })}
              required
            >
              {zones.map((z) => (
                <option key={z.code} value={z.code}>{z.name}</option>
              ))}
            </select>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
