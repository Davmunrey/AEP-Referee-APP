"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, X } from "lucide-react";
import { dialogOverlayEnter, dialogPanelEnter } from "@/components/aep/motion";
import { Button } from "@/components/ui/button";
import { useEscapeClose } from "@/hooks/use-escape-close";
import { api } from "@/lib/api/client";
import {
  isInviteProblem,
  JUDGE_INVITE_OUTCOME_LABEL,
  type JudgeAccessStatus,
  type JudgeInviteResult,
} from "@/lib/judge-access";
import { contar } from "@/lib/plural";

type Candidate = { id: string; nombre: string; email?: string };

/**
 * Invitar al portal a los jueces de la lista que se está viendo (con los
 * filtros del directorio aplicados). Solo a los que aún no tienen acceso y
 * tienen e-mail; los demás se cuentan para que se sepa por qué no entran.
 */
export function PortalInviteDialog({
  open,
  onClose,
  referees,
  statuses,
}: {
  open: boolean;
  onClose: () => void;
  referees: Candidate[];
  statuses: Record<string, JudgeAccessStatus>;
}) {
  const router = useRouter();
  const dialogRef = useEscapeClose<HTMLDivElement>(onClose, open);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<JudgeInviteResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const withAccess = referees.filter((r) => statuses[r.id] === "con-acceso");
  const revoked = referees.filter((r) => statuses[r.id] === "revocado");
  const noEmail = referees.filter((r) => statuses[r.id] !== "con-acceso" && !r.email);
  const toInvite = referees.filter((r) => (statuses[r.id] ?? "sin-acceso") === "sin-acceso" && r.email);

  const send = async () => {
    setSending(true);
    setError(null);
    setProgress(0);
    const all: JudgeInviteResult[] = [];
    try {
      for (let i = 0; i < toInvite.length; i += 200) {
        const chunk = toInvite.slice(i, i + 200).map((r) => r.id);
        const { results: part } = await api.inviteToPortal(chunk);
        all.push(...part);
        setProgress(all.length);
      }
      setResults(all);
      router.refresh();
    } catch (err) {
      setResults(all.length ? all : null);
      setError(err instanceof Error ? err.message : "No se pudieron enviar las invitaciones");
    } finally {
      setSending(false);
    }
  };

  const problems = (results ?? []).filter((r) => isInviteProblem(r.outcome));
  const ok = (results ?? []).length - problems.length;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 ${dialogOverlayEnter}`}
      onClick={sending ? undefined : onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-invite-title"
        className={`w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-md outline-none ${dialogPanelEnter}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 id="portal-invite-title" className="text-base font-semibold text-foreground">
            Invitar al portal del juez
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={sending} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          {results ? (
            <>
              <p className="text-foreground">
                {ok > 0 ? `${contar(ok, "invitación enviada", "invitaciones enviadas")}.` : "No se envió ninguna invitación."}{" "}
                Cada juez recibe un enlace para entrar con el e-mail de su ficha.
              </p>
              {problems.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-foreground-secondary">
                    {contar(problems.length, "juez necesita", "jueces necesitan")} revisión:
                  </p>
                  <ul className="max-h-48 divide-y divide-border-muted overflow-y-auto rounded-lg border border-border-muted">
                    {problems.map((r) => (
                      <li key={r.refereeId} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-xs">
                        <span className="truncate text-foreground">{r.nombre}</span>
                        <span className="shrink-0 text-warning">{JUDGE_INVITE_OUTCOME_LABEL[r.outcome]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="leading-relaxed text-muted-foreground">
                Con su cuenta, cada juez ve sus designaciones y se apunta a las convocatorias de su zona. Entra con
                un enlace que le llega al e-mail de su ficha, sin contraseña.
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">En la lista actual</dt>
                <dd className="text-right tabular-nums text-foreground">{referees.length}</dd>
                <dt className="text-muted-foreground">Ya tienen acceso</dt>
                <dd className="text-right tabular-nums text-foreground">{withAccess.length}</dd>
                <dt className="text-muted-foreground">Con el acceso retirado</dt>
                <dd className="text-right tabular-nums text-foreground">{revoked.length}</dd>
                <dt className="text-muted-foreground">Sin e-mail en la ficha</dt>
                <dd className="text-right tabular-nums text-foreground">{noEmail.length}</dd>
              </dl>
              <p className="text-xs text-muted-foreground">
                Los jueces con el acceso retirado se reactivan desde su ficha, uno a uno. Usa los filtros del directorio
                para invitar solo a una zona o un nivel.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border-muted px-5 py-3">
          {results ? (
            <Button size="sm" onClick={onClose}>
              Hecho
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
                Cancelar
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => void send()} disabled={sending || toInvite.length === 0}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
                {sending
                  ? `Enviando ${progress}/${toInvite.length}…`
                  : toInvite.length === 0
                    ? "No hay nadie a quien invitar"
                    : `Invitar a ${contar(toInvite.length, "juez", "jueces")}`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
