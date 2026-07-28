"use client";

import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useEscapeClose } from "@/hooks/use-escape-close";

interface CredentialsBannerProps {
  email: string;
  password: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}

export function CredentialsBanner({
  email,
  password,
  copied,
  onCopy,
  onClose,
}: CredentialsBannerProps) {
  const panelRef = useEscapeClose(onClose);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credentials-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={panelRef} tabIndex={-1} className="outline-none w-full max-w-sm rounded-2xl border border-border-strong bg-card p-6 shadow-xl">
        <h3 id="credentials-title" className="text-base font-semibold text-foreground">
          Usuario creado
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Comparte estas credenciales con el nuevo usuario. El usuario también puede usar el enlace
          de recuperación de contraseña de Supabase para actualizar su acceso.
        </p>
        <div className="mt-4 rounded-xl border border-border-muted bg-surface p-3 font-mono text-sm">
          <p className="text-foreground-secondary">
            <span className="text-subtle-muted">Email:</span>{" "}
            <span className="select-all">{email}</span>
          </p>
          <p className="mt-1 text-foreground-secondary">
            <span className="text-subtle-muted">Contraseña:</span>{" "}
            <span className="select-all">{password}</span>
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCopy} className="gap-1.5">
            {copied ? (
              <Check className="h-4 w-4 text-success" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copiado" : "Copiar credenciales"}
          </Button>
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
