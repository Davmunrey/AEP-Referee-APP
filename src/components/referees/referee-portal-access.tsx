"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { confirmar } from "@/components/ui/confirm-dialog";
import { AccessCodeCard } from "@/components/referees/access-code-card";
import { api } from "@/lib/api/client";
import {
  JUDGE_ACCESS_LABEL,
  JUDGE_CODE_OUTCOME_LABEL,
  type JudgeAccessStatus,
  type JudgeCodeResult,
} from "@/lib/judge-access";
import { formatDate } from "@/lib/utils";

/**
 * Acceso de este juez al portal: estado, dar acceso (o un código nuevo si
 * olvidó su contraseña) y retirarlo. Sin correos: el código se le pasa por
 * WhatsApp o en mano.
 */
export function RefereePortalAccess({
  refereeId,
  nombre,
  email,
  status,
  codeExpiresAt,
}: {
  refereeId: string;
  nombre: string;
  email?: string;
  status: JudgeAccessStatus;
  codeExpiresAt?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"code" | "revoke" | null>(null);
  const [issued, setIssued] = useState<JudgeCodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issue = async () => {
    if (status === "codigo-pendiente" || status === "con-acceso") {
      const ok = await confirmar({
        titulo: "¿Generar un código nuevo?",
        detalle:
          status === "con-acceso"
            ? "Sirve si ha olvidado su contraseña: con el código nuevo crea otra. La actual sigue valiendo hasta que lo use."
            : "El código que tiene sin usar dejará de valer.",
        accion: "Generar código",
      });
      if (!ok) return;
    }
    setBusy("code");
    setError(null);
    try {
      const { result } = await api.issuePortalCode(refereeId);
      if (result.outcome === "codigo" && result.code) {
        setIssued(result);
        router.refresh();
      } else {
        setError(JUDGE_CODE_OUTCOME_LABEL[result.outcome]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el código");
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    const ok = await confirmar({
      titulo: "¿Retirar el acceso al portal?",
      detalle: "El juez dejará de poder entrar al momento y su código pendiente, si lo tiene, deja de valer.",
      accion: "Retirar acceso",
      peligro: true,
    });
    if (!ok) return;
    setBusy("revoke");
    setError(null);
    setIssued(null);
    try {
      await api.revokePortalAccess(refereeId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo retirar el acceso");
    } finally {
      setBusy(null);
    }
  };

  const hasEmail = Boolean(email);
  const detail =
    status === "codigo-pendiente" && codeExpiresAt
      ? `Tiene un código sin usar hasta el ${formatDate(codeExpiresAt.slice(0, 10))}`
      : status === "sin-acceso" && !hasEmail
        ? "Añade su e-mail a la ficha para poder darle acceso"
        : status === "con-acceso"
          ? "Entra con su e-mail y su contraseña"
          : null;

  return (
    <Card className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Portal del juez</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {JUDGE_ACCESS_LABEL[status]}
            {detail ? ` · ${detail}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(status === "con-acceso" || status === "codigo-pendiente") && (
            <Button variant="ghost" size="sm" onClick={() => void revoke()} disabled={busy !== null}>
              {busy === "revoke" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Retirar acceso
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void issue()} disabled={busy !== null || !hasEmail}>
            {busy === "code" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {status === "sin-acceso" ? "Dar acceso" : status === "revocado" ? "Devolver acceso" : "Código nuevo"}
          </Button>
        </div>
      </div>
      {issued?.code && issued.expiresAt && (
        <AccessCodeCard nombre={nombre} email={email} code={issued.code} expiresAt={issued.expiresAt} />
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </Card>
  );
}
