"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEscapeClose } from "@/hooks/use-escape-close";
import { selectFieldClass, textareaFieldClass } from "@/lib/design-tokens";
import { formatApiError } from "@/lib/api/error-message";
import {
  createTicket,
  TICKET_ACCEPT_ATTR,
  TICKET_MAX_FILES,
  validateTicketFiles,
} from "@/lib/api/tickets-client";
import { CATEGORY_LABELS, TICKET_CATEGORIES } from "@/components/tickets/ticket-shared";
import type { TicketCategory } from "@/lib/types";
import { dialogOverlayEnter, dialogPanelEnter } from "@/components/aep/motion";

const inputClass =
  "h-9 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle-muted focus-ring";

export function NewTicketDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const panelRef = useEscapeClose<HTMLDivElement>(onClose);
  const [pending, startTransition] = useTransition();

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<TicketCategory>("incidencia");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Previews con objectURL: se revocan al cambiar/desmontar para no filtrar memoria.
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
    const t = titulo.trim();
    const d = descripcion.trim();
    if (t.length < 4 || t.length > 140) {
      setError("El título debe tener entre 4 y 140 caracteres.");
      return;
    }
    if (d.length < 10 || d.length > 5000) {
      setError("La descripción debe tener entre 10 y 5000 caracteres.");
      return;
    }
    const validation = validateTicketFiles(files);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);

    const form = new FormData();
    form.append("titulo", t);
    form.append("descripcion", d);
    form.append("categoria", categoria);
    files.forEach((f) => form.append("files", f));

    startTransition(async () => {
      try {
        await createTicket(form);
        onClose();
        router.refresh();
      } catch (err) {
        setError(formatApiError(err, "No se pudo crear el ticket."));
      }
    });
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm ${dialogOverlayEnter}`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-ticket-title"
        className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl outline-none ${dialogPanelEnter}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="new-ticket-title" className="text-base font-semibold text-foreground">
            Nuevo ticket de soporte
          </h2>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="ticket-titulo" className="friendly-label mb-1 block">
              Título
            </label>
            <input
              id="ticket-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Resumen breve del problema o propuesta"
              className={inputClass}
              maxLength={140}
              required
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Entre 4 y 140 caracteres.
            </p>
          </div>

          <div>
            <label htmlFor="ticket-categoria" className="friendly-label mb-1 block">
              Categoría
            </label>
            <select
              id="ticket-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as TicketCategory)}
              className={selectFieldClass}
            >
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ticket-descripcion" className="friendly-label mb-1 block">
              Descripción
            </label>
            <textarea
              id="ticket-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe el contexto, los pasos para reproducirlo y lo que esperabas…"
              className={textareaFieldClass}
              rows={5}
              required
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Entre 10 y 5000 caracteres.
            </p>
          </div>

          <div>
            <span className="friendly-label mb-1 block">
              Fotos <span className="font-normal text-subtle-muted">(opcional)</span>
            </span>
            <label
              htmlFor="ticket-files"
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-hover focus-within:ring-2 focus-within:ring-primary"
            >
              <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Seleccionar imágenes</span>
              <input
                id="ticket-files"
                ref={fileInputRef}
                type="file"
                accept={TICKET_ACCEPT_ATTR}
                multiple
                className="sr-only"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Máximo {TICKET_MAX_FILES} fotos · JPG, PNG, WEBP o GIF · hasta 5 MB cada una.
            </p>

            {previews.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {previews.map((url, i) => (
                  <div key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- preview objectURL local */}
                    <img
                      src={url}
                      alt={files[i]?.name ?? `Foto ${i + 1}`}
                      className="h-16 w-16 rounded-lg border border-border object-cover"
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

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {pending ? "Enviando…" : "Crear ticket"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
