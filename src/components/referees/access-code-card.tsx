"use client";

import { useState } from "react";
import { Check, Copy, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { accessCodeMessage, formatAccessCode } from "@/lib/judge-access";
import { formatDate } from "@/lib/utils";

/**
 * Un código recién generado. Solo se ve ahora: en la base de datos se guarda
 * su resumen, no el código, así que si se pierde hay que generar otro.
 */
export function AccessCodeCard({
  nombre,
  email,
  code,
  expiresAt,
}: {
  nombre: string;
  email?: string;
  code: string;
  expiresAt: string;
}) {
  const [copied, setCopied] = useState<"code" | "message" | null>(null);
  const expiresLabel = formatDate(expiresAt.slice(0, 10));

  const copy = async (what: "code" | "message") => {
    const text =
      what === "code"
        ? formatAccessCode(code)
        : accessCodeMessage({ nombre, email, code, expiresLabel, siteUrl: window.location.origin });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* sin permiso de portapapeles: el código sigue a la vista para copiarlo a mano */
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted-foreground">Código de acceso de {nombre}</p>
      {/* Mono aquí sí: es un dato que se dicta y se copia carácter a carácter. */}
      <p className="mt-1 font-mono text-heading font-semibold tracking-wide text-foreground select-all">
        {formatAccessCode(code)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Vale hasta el {expiresLabel} y una sola vez. No se puede volver a ver: cópialo ahora.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void copy("code")}>
          {copied === "code" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied === "code" ? "Copiado" : "Copiar código"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void copy("message")}>
          {copied === "message" ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied === "message" ? "Copiado" : "Copiar mensaje para el juez"}
        </Button>
      </div>
    </div>
  );
}
