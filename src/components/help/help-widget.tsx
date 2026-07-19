"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  HelpCircle,
  LifeBuoy,
  Mail,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { ROLE_LABELS, type SessionUser } from "@/lib/types";
import {
  KNOWLEDGE_BASE,
  searchKnowledgeBase,
  type HelpEntry,
} from "@/lib/help/knowledge-base";
import { quickStartForRole } from "@/lib/help/quick-start";

const CONTACT_HREF = "/docs#contacto";

/** Temas destacados para el rol (los primeros de la base relevantes a ese rol). */
function featuredTopics(role: SessionUser["role"], limit = 6): HelpEntry[] {
  return KNOWLEDGE_BASE.filter((e) => !e.roles || e.roles.includes(role)).slice(0, limit);
}

/**
 * Widget de Ayuda flotante para usuarios autenticados. Una sola vista:
 *  - Buscador local de temas (base de conocimiento curada, sin IA ni red).
 *  - Sin búsqueda: primeros pasos según el rol + temas destacados.
 * Se renderiza en un portal a <body> para que el overlay `fixed` no quede
 * contenido por ancestros con transform/backdrop-filter.
 */
export function HelpWidget({ user }: { user: Pick<SessionUser, "role" | "nombre"> }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);

  const steps = useMemo(() => quickStartForRole(user.role), [user.role]);
  const topics = useMemo(() => featuredTopics(user.role), [user.role]);
  const results = useMemo(
    () => (query.trim() ? searchKnowledgeBase(query, user.role, 6) : []),
    [query, user.role],
  );

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Enfocar el buscador al abrir.
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  const launcher = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-label={open ? "Cerrar ayuda" : "Abrir ayuda"}
      aria-expanded={open}
      className="fixed bottom-5 right-5 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {open ? <X className="h-5 w-5" /> : <HelpCircle className="h-6 w-6" />}
    </button>
  );

  const searching = query.trim().length > 0;

  const panel = open ? (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Ayuda de AEP Tarima"
      className="fixed bottom-20 right-5 z-[60] flex max-h-[min(36rem,calc(100vh-7rem))] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border-strong bg-card shadow-xl"
    >
      {/* Cabecera */}
      <div className="border-b border-border bg-surface px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LifeBuoy className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-foreground">Centro de ayuda</p>
            <p className="truncate text-[11px] leading-tight text-subtle-muted">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
        </div>
        {/* Buscador */}
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca en la ayuda…"
            aria-label="Buscar en la ayuda"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-subtle-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-primary-border focus-visible:bg-card"
          />
          {searching && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Limpiar búsqueda"
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {searching ? (
          results.length > 0 ? (
            <div className="space-y-2.5">
              {results.map(({ entry }) => (
                <TopicCard key={entry.id} entry={entry} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
              <Search className="mx-auto h-5 w-5 text-subtle-muted" />
              <p className="mt-2 text-sm text-muted-foreground">
                No hay temas para «{query.trim()}».
              </p>
              <p className="mt-0.5 text-xs text-subtle-muted">
                Prueba con otra palabra o consulta la documentación completa.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-5">
            {/* Primeros pasos */}
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-subtle-muted">
                Primeros pasos para tu rol
              </h3>
              <ol className="mt-2.5 space-y-3">
                {steps.map((step, i) => (
                  <li key={step.title} className="relative pl-8">
                    <span className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                    {step.href && (
                      <Link
                        href={step.href}
                        onClick={() => setOpen(false)}
                        className="mt-1 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary underline-offset-2 hover:underline focus-ring"
                      >
                        {step.linkLabel ?? "Abrir"}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </section>

            {/* Temas destacados */}
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-subtle-muted">
                Temas frecuentes
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setQuery(t.question);
                      inputRef.current?.focus();
                    }}
                    className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground-secondary transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-ring"
                  >
                    {t.question}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Pie */}
      <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2.5">
        <Link
          href="/docs"
          onClick={() => setOpen(false)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-ring"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Documentación
        </Link>
        <Link
          href={CONTACT_HREF}
          onClick={() => setOpen(false)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-ring"
        >
          <Mail className="h-3.5 w-3.5" />
          Contacto
        </Link>
      </div>
    </div>
  ) : null;

  if (!mounted) return null;

  return createPortal(
    <>
      {launcher}
      {panel}
    </>,
    document.body,
  );
}

/** Tarjeta de un tema de la base de conocimiento con sus enlaces de acción. */
function TopicCard({ entry, onNavigate }: { entry: HelpEntry; onNavigate: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <p className="text-sm font-semibold leading-snug text-foreground">{entry.question}</p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{entry.answer}</p>
      {entry.links && entry.links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {entry.links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavigate}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-primary underline-offset-2 hover:underline focus-ring"
            >
              {l.label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
