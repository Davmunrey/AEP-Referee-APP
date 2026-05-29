"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface DeleteUserDialogProps {
  nombre: string;
  error: string | null;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteUserDialog({
  nombre,
  error,
  busy,
  onConfirm,
  onClose,
}: DeleteUserDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border-strong bg-card p-6 shadow-xl">
        <h3 id="confirm-delete-title" className="text-base font-semibold text-foreground">
          ¿Eliminar usuario?
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Vas a eliminar a{" "}
          <strong className="text-foreground">{nombre}</strong>. Esta acción no se puede deshacer.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={busy} onClick={onConfirm}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Eliminar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
