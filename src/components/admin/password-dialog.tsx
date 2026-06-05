"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { formatApiError } from "@/lib/api/error-message";
import { Check, Loader2 } from "lucide-react";

interface PasswordDialogProps {
  /** "admin": resetea la de otro usuario. "self": cambia la propia. */
  mode: "admin" | "self";
  /** Requerido en modo admin: id del usuario destino. */
  userId?: string;
  /** Nombre/email mostrado en la cabecera. */
  subject?: string;
  onClose: () => void;
  onDone?: () => void;
}

export function PasswordDialog({ mode, userId, subject, onClose, onDone }: PasswordDialogProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  // Renderizamos en un portal a <body> para que el overlay `fixed` no quede
  // contenido (y recortado) por ancestros con transform/backdrop-filter, como
  // el sidebar. `mounted` evita desajustes de hidratación en SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (next !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setSaving(true);
    try {
      if (mode === "self") {
        await api.changeOwnPassword(current, next);
      } else {
        if (!userId) throw new Error("Falta el usuario destino");
        await api.resetUserPassword(userId, next);
      }
      setDone(true);
      onDone?.();
      window.setTimeout(onClose, 1200);
    } catch (err) {
      setError(formatApiError(err, "No se pudo actualizar la contraseña"));
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border-strong bg-card p-6 shadow-xl">
        <h3 id="password-title" className="text-base font-semibold text-foreground">
          {mode === "self" ? "Cambiar mi contraseña" : "Resetear contraseña"}
        </h3>
        {subject && <p className="mt-1 text-xs text-muted-foreground">{subject}</p>}

        {done ? (
          <div className="mt-5 flex items-center gap-2 text-sm font-medium text-success">
            <Check className="h-4 w-4" />
            Contraseña actualizada
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
            {mode === "self" && (
              <Input
                type="password"
                placeholder="Contraseña actual"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
              />
            )}
            <Input
              type="password"
              placeholder="Nueva contraseña (mín. 8)"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <Input
              type="password"
              placeholder="Repite la nueva contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Actualizar"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
