"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2, X } from "lucide-react";
import { dialogOverlayEnter, dialogPanelEnter } from "@/components/aep/motion";
import { Button } from "@/components/ui/button";
import { useEscapeClose } from "@/hooks/use-escape-close";
import { api } from "@/lib/api/client";
import {
  formatAccessCode,
  isCodeProblem,
  JUDGE_CODE_OUTCOME_LABEL,
  type JudgeAccessStatus,
  type JudgeCodeResult,
} from "@/lib/judge-access";
import { contar } from "@/lib/plural";
import { formatDate } from "@/lib/utils";

type Candidate = { id: string; nombre: string; email?: string };

/**
 * Dar acceso al portal a los jueces de la lista que se está viendo (con los
 * filtros del directorio aplicados): crea sus cuentas y genera un código para
 * cada uno. La aplicación no envía correos: los códigos se copian aquí y se
 * les pasan por WhatsApp o en mano. Solo se ven ahora.
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
  const [results, setResults] = useState<JudgeCodeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!open) return null;

  const withAccess = referees.filter((r) => statuses[r.id] === "con-acceso" || statuses[r.id] === "codigo-pendiente");
  const revoked = referees.filter((r) => statuses[r.id] === "revocado");
  const noEmail = referees.filter((r) => (statuses[r.id] ?? "sin-acceso") === "sin-acceso" && !r.email);
  const toGrant = referees.filter((r) => (statuses[r.id] ?? "sin-acceso") === "sin-acceso" && r.email);

  const send = async () => {
    setSending(true);
    setError(null);
    setProgress(0);
    const all: JudgeCodeResult[] = [];
    try {
      for (let i = 0; i < toGrant.length; i += 200) {
        const chunk = toGrant.slice(i, i + 200).map((r) => r.id);
        const { results: part } = await api.issuePortalCodes(chunk);
        all.push(...part);
        setProgress(all.length);
      }
      setResults(all);
      router.refresh();
    } catch (err) {
      setResults(all.length ? all : null);
      setError(err instanceof Error ? err.message : "No se pudieron generar los códigos");
    } finally {
      setSending(false);
    }
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* sin permiso de portapapeles: los códigos siguen a la vista */
    }
  };

  const granted = (results ?? []).filter((r) => r.outcome === "codigo" && r.code);
  const problems = (results ?? []).filter((r) => isCodeProblem(r.outcome));
  const expiresLabel = granted[0]?.expiresAt ? formatDate(granted[0].expiresAt.slice(0, 10)) : null;
  const allText = granted.map((r) => `${r.nombre} · ${r.email ?? ""} · ${formatAccessCode(r.code!)}`).join("\n");

  return (
    <div className={`fixed inset-0 z-(--z-modal) flex items-center justify-center bg-overlay p-4 ${dialogOverlayEnter}`} onClick={sending ? undefined : onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-invite-title"
        className={`flex max-h-(--size-dialog-h) w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-md outline-none ${dialogPanelEnter}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="portal-invite-title" className="text-base font-semibold text-foreground">
            Dar acceso al portal
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={sending} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {results ? (
            <>
              {granted.length > 0 ? (
                <>
                  <p className="text-pretty text-foreground">
                    {contar(granted.length, "código generado", "códigos generados")}
                    {expiresLabel ? `, válidos hasta el ${expiresLabel}` : ""}. Pásale a cada juez el suyo: entra en
                    «Soy juez › Tengo un código» con su e-mail y crea su contraseña.
                  </p>
                  <p className="text-xs text-warning">No se pueden volver a ver: cópialos antes de cerrar.</p>
                  <ul className="divide-y divide-border-muted rounded-lg border border-border-muted">
                    {granted.map((r) => (
                      <li key={r.refereeId} className="flex items-center gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{r.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-semibold text-foreground select-all">
                          {formatAccessCode(r.code!)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          aria-label={`Copiar el código de ${r.nombre}`}
                          onClick={() => void copy(r.refereeId, formatAccessCode(r.code!))}
                        >
                          {copied === r.refereeId ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-foreground">No se ha generado ningún código.</p>
              )}
              {problems.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-foreground-secondary">
                    {contar(problems.length, "juez necesita", "jueces necesitan")} revisión:
                  </p>
                  <ul className="max-h-48 divide-y divide-border-muted overflow-y-auto rounded-lg border border-border-muted">
                    {problems.map((r) => (
                      <li key={r.refereeId} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-xs">
                        <span className="truncate text-foreground">{r.nombre}</span>
                        <span className="shrink-0 text-warning">{JUDGE_CODE_OUTCOME_LABEL[r.outcome]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-pretty leading-relaxed text-muted-foreground">
                Con su cuenta, cada juez ve sus designaciones y se apunta a las convocatorias de su zona. La aplicación
                no envía correos: aquí se genera un código para cada uno, se lo pasas por WhatsApp o en mano y con él
                crea su contraseña.
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">En la lista actual</dt>
                <dd className="text-right tabular-nums text-foreground">{referees.length}</dd>
                <dt className="text-muted-foreground">Ya tienen acceso o código</dt>
                <dd className="text-right tabular-nums text-foreground">{withAccess.length}</dd>
                <dt className="text-muted-foreground">Con el acceso retirado</dt>
                <dd className="text-right tabular-nums text-foreground">{revoked.length}</dd>
                <dt className="text-muted-foreground">Sin e-mail en la ficha</dt>
                <dd className="text-right tabular-nums text-foreground">{noEmail.length}</dd>
              </dl>
              <p className="text-pretty text-xs text-muted-foreground">
                Los que ya tienen acceso, o lo tienen retirado, se gestionan desde su ficha, uno a uno (también el
                código nuevo para quien olvida su contraseña). Usa los filtros del directorio para dar acceso solo a una
                zona o un nivel.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border-muted px-5 py-3">
          {results ? (
            <>
              {granted.length > 1 && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void copy("all", allText)}>
                  {copied === "all" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  {copied === "all" ? "Copiados" : "Copiar todos"}
                </Button>
              )}
              <Button size="sm" onClick={onClose}>
                Hecho
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
                Cancelar
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => void send()} disabled={sending || toGrant.length === 0}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />}
                {sending
                  ? `Generando ${progress}/${toGrant.length}…`
                  : toGrant.length === 0
                    ? "No hay nadie sin acceso"
                    : `Dar acceso a ${contar(toGrant.length, "juez", "jueces")}`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
