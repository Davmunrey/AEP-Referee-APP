"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import {
  isInviteProblem,
  JUDGE_ACCESS_LABEL,
  JUDGE_INVITE_OUTCOME_LABEL,
  type JudgeAccessStatus,
} from "@/lib/judge-access";
import { cn } from "@/lib/utils";

/** Acceso de este juez al portal: estado, invitar o reenviar el enlace, retirar. */
export function RefereePortalAccess({
  refereeId,
  status,
  hasEmail,
}: {
  refereeId: string;
  status: JudgeAccessStatus;
  hasEmail: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"invite" | "revoke" | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);

  const invite = async () => {
    setBusy("invite");
    setMessage(null);
    try {
      const { results } = await api.inviteToPortal([refereeId]);
      const outcome = results[0]?.outcome ?? "error";
      setMessage({
        text:
          outcome === "invitado"
            ? "Invitación enviada. Le llegará un enlace al e-mail de su ficha."
            : outcome === "enlace-reenviado" || outcome === "reactivado"
              ? `${JUDGE_INVITE_OUTCOME_LABEL[outcome]}: le llegará un enlace para entrar.`
              : JUDGE_INVITE_OUTCOME_LABEL[outcome],
        tone: isInviteProblem(outcome) ? "warn" : "ok",
      });
      router.refresh();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "No se pudo enviar la invitación", tone: "warn" });
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    if (!window.confirm("¿Retirar el acceso al portal? El juez dejará de poder entrar al momento.")) return;
    setBusy("revoke");
    setMessage(null);
    try {
      await api.revokePortalAccess(refereeId);
      setMessage({ text: "Acceso retirado.", tone: "ok" });
      router.refresh();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "No se pudo retirar el acceso", tone: "warn" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">Portal del juez</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {JUDGE_ACCESS_LABEL[status]}
          {status === "sin-acceso" && !hasEmail && " · añade su e-mail a la ficha para poder invitarle"}
        </p>
        {message && (
          <p role="status" className={cn("mt-1 text-xs", message.tone === "ok" ? "text-success" : "text-warning")}>
            {message.text}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {status === "con-acceso" && (
          <Button variant="ghost" size="sm" onClick={() => void revoke()} disabled={busy !== null}>
            {busy === "revoke" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Retirar acceso
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => void invite()} disabled={busy !== null || !hasEmail}>
          {busy === "invite" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {status === "sin-acceso" ? "Invitar" : status === "revocado" ? "Devolver acceso" : "Reenviar enlace"}
        </Button>
      </div>
    </Card>
  );
}
