"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatApiError } from "@/lib/api/error-message";
import { textareaFieldClass } from "@/lib/design-tokens";
import {
  addTicketComment,
  patchTicket,
  TICKET_ACCEPT_ATTR,
  TICKET_MAX_FILES,
  validateTicketFiles,
} from "@/lib/api/tickets-client";
import {
  AttachmentImage,
  AttachmentThumb,
  CategoryBadge,
  relativeDate,
  shortDate,
  shortDateTime,
  STATUS_LABELS,
  TicketStatusPill,
} from "@/components/tickets/ticket-shared";
import { cn } from "@/lib/utils";
import type {
  SessionUser,
  SupportTicket,
  SupportTicketAttachment,
  TicketStatus,
} from "@/lib/types";

const ADMIN_ROLES = ["super_admin", "delegado_jueces"];

/** Galería de adjuntos: cada imagen abre su signedUrl en pestaña nueva. */
function AttachmentGallery({
  attachments,
}: {
  attachments: SupportTicketAttachment[];
}) {
  const photos = attachments.filter((a) => a.signedUrl);
  if (photos.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((a) => (
        <a
          key={a.id}
          href={a.signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Abrir ${a.fileName}`}
          className="group block overflow-hidden rounded-xl border border-border focus-ring"
        >
          <AttachmentImage
            attachment={a}
            className="aspect-square w-full object-cover transition-transform duration-150 group-hover:scale-[1.03]"
          />
        </a>
      ))}
    </div>
  );
}

export function TicketDetail({
  initialTicket,
  currentUser,
}: {
  initialTicket: SupportTicket;
  currentUser: SessionUser;
}) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initialTicket);

  // Re-sincroniza con el servidor tras router.refresh() (patrón competitions-table).
  useEffect(() => {
    setTicket(initialTicket);
  }, [initialTicket]);

  const isAdmin = ADMIN_ROLES.includes(currentUser.role);
  const isCreator = ticket.createdById === currentUser.id;

  return (
    <PageShell className="max-w-3xl">
      <Button variant="outline" size="sm" className="w-fit" asChild>
        <Link href="/tickets">
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          Soporte
        </Link>
      </Button>

      {/* Cabecera */}
      <Card className="p-0">
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge categoria={ticket.categoria} />
            <TicketStatusPill status={ticket.status} />
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-foreground">
            {ticket.titulo}
          </h1>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Abierto por {ticket.createdByName} · {shortDate(ticket.createdAt)}
            {ticket.updatedAt !== ticket.createdAt && (
              <> · actualizado {relativeDate(ticket.updatedAt)}</>
            )}
          </p>
        </div>
      </Card>

      {/* Banner de resolución */}
      {ticket.status === "resuelto" && ticket.resolutionNote && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-success-border bg-success-muted px-4 py-3">
          <CheckCircle2
            className="mt-px h-4 w-4 shrink-0 text-success"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-success">
              Resuelto
              {ticket.resolvedBy ? ` por ${ticket.resolvedBy}` : ""}
              {ticket.resolvedAt ? ` · ${shortDate(ticket.resolvedAt)}` : ""}
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-success">
              {ticket.resolutionNote}
            </p>
          </div>
        </div>
      )}

      {/* Descripción + fotos del ticket */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Descripción</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground-secondary">
            {ticket.descripcion}
          </p>
          <AttachmentGallery attachments={ticket.attachments} />
        </CardContent>
      </Card>

      {/* Controles de estado */}
      <StatusControls
        ticket={ticket}
        isAdmin={isAdmin}
        isCreator={isCreator}
        onUpdated={(updated) => {
          setTicket(updated);
          router.refresh();
        }}
      />

      {/* Hilo de comentarios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Comentarios{" "}
            <span className="font-normal text-subtle-muted">
              ({ticket.comments.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay comentarios. Sé el primero en aportar contexto.
            </p>
          ) : (
            <ul className="space-y-4">
              {ticket.comments.map((c) => {
                const photos = c.attachments.filter((a) => a.signedUrl);
                return (
                  <li
                    key={c.id}
                    className="rounded-xl border border-border-muted bg-surface/40 px-4 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {c.authorName}
                      </p>
                      <p className="text-[11px] text-subtle-muted">
                        {shortDateTime(c.createdAt)}
                      </p>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground-secondary">
                      {c.body}
                    </p>
                    {photos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {photos.map((a) => (
                          <a
                            key={a.id}
                            href={a.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Abrir ${a.fileName}`}
                            className="block rounded focus-ring"
                          >
                            <AttachmentThumb attachment={a} />
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <CommentForm
            ticketId={ticket.id}
            onAdded={() => router.refresh()}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}

// ── Controles de estado ─────────────────────────────────────────────────────

function StatusControls({
  ticket,
  isAdmin,
  isCreator,
  onUpdated,
}: {
  ticket: SupportTicket;
  isAdmin: boolean;
  isCreator: boolean;
  onUpdated: (t: SupportTicket) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  // El creador que no es admin solo puede cerrar su propio ticket.
  const creatorCanClose = isCreator && !isAdmin && ticket.status !== "cerrado";

  if (!isAdmin && !creatorCanClose) return null;

  const apply = (payload: { status?: TicketStatus; resolutionNote?: string }) => {
    setError(null);
    startTransition(async () => {
      try {
        const updated = await patchTicket(ticket.id, payload);
        setResolving(false);
        setResolutionNote("");
        onUpdated(updated);
      } catch (err) {
        setError(formatApiError(err, "No se pudo actualizar el ticket."));
      }
    });
  };

  const ADMIN_OPTIONS: TicketStatus[] = ["abierto", "en_progreso", "resuelto", "cerrado"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Gestión del estado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdmin ? (
          <>
            <div className="flex flex-wrap gap-2">
              {ADMIN_OPTIONS.map((s) => {
                const active = ticket.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (s === "resuelto") {
                        setResolving(true);
                        setResolutionNote(ticket.resolutionNote ?? "");
                        setError(null);
                      } else {
                        setResolving(false);
                        apply({ status: s });
                      }
                    }}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-ring disabled:opacity-50",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-hover",
                    )}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>

            {resolving && (
              <div className="rounded-xl border border-border-muted bg-surface/40 px-4 py-3">
                <label
                  htmlFor="resolution-note"
                  className="friendly-label mb-1 block"
                >
                  Nota de resolución{" "}
                  <span className="font-normal text-subtle-muted">(opcional)</span>
                </label>
                <textarea
                  id="resolution-note"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Describe cómo se ha resuelto…"
                  className={textareaFieldClass}
                  rows={3}
                  autoFocus
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setResolving(false);
                      setResolutionNote("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      apply({
                        status: "resuelto",
                        resolutionNote: resolutionNote.trim() || undefined,
                      })
                    }
                  >
                    {pending && (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    )}
                    Marcar como resuelto
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Puedes cerrar este ticket cuando ya no lo necesites.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => apply({ status: "cerrado" })}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Cerrar ticket
            </Button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive-border bg-destructive-muted px-3.5 py-2.5 text-xs leading-snug text-destructive"
          >
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Formulario de comentario ────────────────────────────────────────────────

function CommentForm({
  ticketId,
  onAdded,
}: {
  ticketId: string;
  onAdded: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list);
    const validation = validateTicketFiles(picked);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setFiles(picked);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (text.length < 1 || text.length > 3000) {
      setError("El comentario debe tener entre 1 y 3000 caracteres.");
      return;
    }
    const validation = validateTicketFiles(files);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);

    const form = new FormData();
    form.append("body", text);
    files.forEach((f) => form.append("files", f));

    startTransition(async () => {
      try {
        await addTicketComment(ticketId, form);
        setBody("");
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onAdded();
      } catch (err) {
        setError(formatApiError(err, "No se pudo publicar el comentario."));
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-border-muted pt-4">
      <div>
        <label htmlFor="comment-body" className="friendly-label mb-1 block">
          Añadir comentario
        </label>
        <textarea
          id="comment-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe una respuesta o aporta más detalles…"
          className={textareaFieldClass}
          rows={3}
          maxLength={3000}
          required
        />
      </div>

      <div>
        <label
          htmlFor="comment-files"
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-surface-hover focus-within:ring-2 focus-within:ring-primary"
        >
          <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Adjuntar fotos
          <input
            id="comment-files"
            ref={fileInputRef}
            type="file"
            accept={TICKET_ACCEPT_ATTR}
            multiple
            className="sr-only"
            onChange={(e) => onPickFiles(e.target.files)}
          />
        </label>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Opcional · máximo {TICKET_MAX_FILES} fotos · JPG, PNG, WEBP o GIF · hasta 5 MB.
        </p>

        {previews.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {previews.map((url, i) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview objectURL local */}
                <img
                  src={url}
                  alt={files[i]?.name ?? `Foto ${i + 1}`}
                  className="h-14 w-14 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label={`Quitar ${files[i]?.name ?? "foto"}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-destructive focus-ring"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive-border bg-destructive-muted px-3.5 py-2.5 text-xs leading-snug text-destructive"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? "Publicando…" : "Comentar"}
        </Button>
      </div>
    </form>
  );
}
