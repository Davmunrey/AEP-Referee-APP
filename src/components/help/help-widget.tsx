"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  HelpCircle,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { ROLE_LABELS, type SessionUser } from "@/lib/types";
import { searchKnowledgeBase, type HelpLink } from "@/lib/help/knowledge-base";
import { quickStartForRole } from "@/lib/help/quick-start";

type Tab = "guia" | "asistente";

interface ChatMessage {
  id: number;
  from: "user" | "bot";
  text: string;
  links?: HelpLink[];
  /** Preguntas sugeridas relacionadas (otras entradas que también encajan). */
  suggestions?: string[];
  /** Mientras se espera la respuesta del asistente IA. */
  pending?: boolean;
}

const NO_MATCH =
  "No he encontrado una respuesta exacta. Puedes consultar la documentación completa o escribir al Comité de Jueces.";
const NO_MATCH_LINKS: HelpLink[] = [
  { label: "Documentación", href: "/docs" },
  { label: "Contacto", href: "/docs#contacto" },
];

const WELCOME: ChatMessage = {
  id: 0,
  from: "bot",
  text:
    "Hola 👋 Soy el asistente de AEP Tarima. Pregúntame cómo usar la plataforma (tarima, compensación, normativa, permisos…) y te indico los pasos con enlaces a cada sección. Las respuestas se basan en la documentación oficial de la app.",
};

/**
 * Widget de Ayuda flotante para usuarios autenticados. Dos pestañas:
 *  - «Guía»: tour de primeros pasos adaptado al rol.
 *  - «Asistente»: bot local que busca en la documentación (sin IA externa).
 * Se renderiza en un portal a <body> para que el overlay `fixed` no quede
 * contenido por ancestros con transform/backdrop-filter.
 */
export function HelpWidget({ user }: { user: Pick<SessionUser, "role" | "nombre"> }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("guia");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  // Cuando el asistente IA no está disponible (sin clave o error), se desactiva
  // y las siguientes preguntas se resuelven directamente con el asistente local.
  const [remoteEnabled, setRemoteEnabled] = useState(true);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);

  const steps = useMemo(() => quickStartForRole(user.role), [user.role]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Autoscroll del chat al añadir mensajes.
  useEffect(() => {
    if (tab === "asistente") scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, tab]);

  const ask = async (raw: string) => {
    const query = raw.trim();
    if (!query) return;

    // Resultados locales: aportan enlaces de acción y sirven de respaldo.
    const local = searchKnowledgeBase(query, user.role);
    const localText = local[0]?.entry.answer ?? NO_MATCH;
    const localLinks = local.length > 0 ? local[0]?.entry.links : NO_MATCH_LINKS;
    const suggestions = local.slice(1, 4).map((r) => r.entry.question);

    // Historial para el modelo (sin la bienvenida ni mensajes en curso).
    const history = messages
      .filter((m) => m.id !== 0 && !m.pending)
      .slice(-8)
      .map((m) => ({ role: m.from === "user" ? ("user" as const) : ("model" as const), text: m.text }));

    setInput("");
    setMessages((prev) => [...prev, { id: nextId.current++, from: "user", text: query }]);

    if (!remoteEnabled) {
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, from: "bot", text: localText, links: localLinks, suggestions },
      ]);
      return;
    }

    const pendingId = nextId.current++;
    setMessages((prev) => [...prev, { id: pendingId, from: "bot", text: "", pending: true }]);
    try {
      const { reply } = await api.askAssistant(query, history);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, text: reply, links: localLinks, suggestions, pending: false } : m,
        ),
      );
    } catch {
      // Sin clave o error del proveedor → fallback al asistente local.
      setRemoteEnabled(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, text: localText, links: localLinks, suggestions, pending: false } : m,
        ),
      );
    }
  };

  const launcher = (
    <button
      type="button"
      onClick={() => {
        setOpen((o) => !o);
        if (!open && tab === "asistente") {
          window.setTimeout(() => inputRef.current?.focus(), 50);
        }
      }}
      aria-label={open ? "Cerrar ayuda" : "Abrir ayuda"}
      aria-expanded={open}
      className="fixed bottom-5 right-5 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {open ? <X className="h-5 w-5" /> : <HelpCircle className="h-6 w-6" />}
    </button>
  );

  const panel = open ? (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Ayuda de AEP Tarima"
      className="fixed bottom-20 right-5 z-[60] flex max-h-[min(34rem,calc(100vh-7rem))] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border-strong bg-card shadow-xl"
    >
      {/* Cabecera + pestañas */}
      <div className="border-b border-border bg-surface px-4 pt-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Ayuda</p>
          <span className="ml-auto text-[11px] text-subtle-muted">{ROLE_LABELS[user.role]}</span>
        </div>
        <div className="mt-2 flex gap-1">
          <TabButton active={tab === "guia"} onClick={() => setTab("guia")} icon={BookOpen}>
            Guía
          </TabButton>
          <TabButton
            active={tab === "asistente"}
            onClick={() => {
              setTab("asistente");
              window.setTimeout(() => inputRef.current?.focus(), 50);
            }}
            icon={MessageCircle}
          >
            Asistente
          </TabButton>
        </div>
      </div>

      {tab === "guia" ? (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Primeros pasos para tu rol. Toca un enlace para ir directamente.
          </p>
          <ol className="mt-3 space-y-3">
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
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {step.linkLabel ?? "Abrir"}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </li>
            ))}
          </ol>
          <Link
            href="/docs"
            onClick={() => setOpen(false)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Documentación completa
          </Link>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    m.from === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-foreground",
                  )}
                >
                  {m.pending ? (
                    <p className="flex items-center gap-1 text-muted-foreground" aria-live="polite">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Escribiendo…
                    </p>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  )}
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {l.label}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-medium text-subtle-muted">También puede interesarte:</p>
                      {m.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void ask(s)}
                          className="block w-full rounded-md px-2 py-1 text-left text-xs text-primary underline-offset-2 hover:bg-muted hover:underline"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2.5"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              aria-label="Tu pregunta"
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Enviar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
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

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
