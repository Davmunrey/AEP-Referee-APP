"use client";

import { useMemo, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { AepGuidePanel } from "@/components/regulations/aep-guide-panel";
import { CompensationNormativaPanel } from "@/components/regulations/compensation-normativa-panel";
import { AEP_GUIDE_META } from "@/lib/aep-guide-2026";
import type { IpfChapter } from "@/lib/types";
import { IPF_CHAPTERS } from "@/lib/ipf-chapters";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Link2,
  Search,
  X,
} from "lucide-react";

/** Wraps query matches in a <mark> for visual highlighting. */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="rounded-sm bg-warning-muted px-0.5 font-medium text-foreground not-italic"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function IpfArticleList({
  chapter,
  expandAll = false,
  query = "",
}: {
  chapter: IpfChapter;
  expandAll?: boolean;
  query?: string;
}) {
  const [openArticles, setOpenArticles] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggle = (num: string) => {
    setOpenArticles((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <div className="divide-y divide-border-muted">
      {chapter.articles.map((art) => {
        const anchorId = `ipf-art-${chapter.num}-${art.num}`;
        const isOpen = expandAll || openArticles.has(art.num);
        const label = art.title
          ? `Art. ${chapter.num}.${art.num} — ${art.title}`
          : `Art. ${chapter.num}.${art.num}`;
        return (
          <div key={art.num} id={anchorId} className="group">
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => toggle(art.num)}
                className="flex min-h-11 flex-1 items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors focus-ring hover:bg-surface-hover"
                aria-expanded={isOpen}
                aria-controls={`${anchorId}-content`}
              >
                <span className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true">
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {query ? <HighlightText text={label} query={query} /> : label}
                </span>
              </button>
              <button
                type="button"
                onClick={() => copyLink(anchorId)}
                title={copiedId === anchorId ? "¡Enlace copiado!" : "Copiar enlace al artículo"}
                aria-label="Copiar enlace al artículo"
                className="flex min-w-9 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-ring"
              >
                {copiedId === anchorId ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Link2 className="h-3.5 w-3.5 text-subtle-muted" />
                )}
              </button>
            </div>
            {isOpen && (
              <div id={`${anchorId}-content`} className="pb-4 pl-8 pr-2">
                <p className="max-w-prose whitespace-pre-line text-title leading-relaxed text-foreground-secondary">
                  {query ? <HighlightText text={art.text} query={query} /> : art.text}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type RegulationsTab = "guide" | "compensation" | "ipf";

const TABS: { id: RegulationsTab; label: string }[] = [
  { id: "guide", label: `Guía AEP ${AEP_GUIDE_META.season}` },
  { id: "compensation", label: "Compensación jueces" },
  { id: "ipf", label: "Reglamento IPF" },
];

export function RegulationsView() {
  const [tab, setTab] = useState<RegulationsTab>("guide");
  const [openChapters, setOpenChapters] = useState<Set<string>>(
    new Set(IPF_CHAPTERS.map((c) => c.num)),
  );
  const [ipfQuery, setIpfQuery] = useState("");

  const q = ipfQuery.trim().toLowerCase();
  // Filtra los 98 artículos (con toLowerCase del texto completo) solo cuando
  // cambia la consulta, no en cada render/tecla del resto de la vista.
  const ipfChapters: IpfChapter[] = useMemo(
    () =>
      !q
        ? IPF_CHAPTERS
        : IPF_CHAPTERS.flatMap((c) => {
            const chapterMatch = `cap ${c.num} ${c.title}`.toLowerCase().includes(q);
            if (chapterMatch) return [c];
            const articles = c.articles.filter((a) =>
              `${c.num}.${a.num} ${a.title ?? ""} ${a.text}`.toLowerCase().includes(q),
            );
            return articles.length ? [{ ...c, articles }] : [];
          }),
    [q],
  );
  const ipfArticleCount = useMemo(
    () => ipfChapters.reduce((n, c) => n + c.articles.length, 0),
    [ipfChapters],
  );

  const toggleChapter = (num: string) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="Normativa"
        description="Guía AEP, compensación de jueces y reglamento técnico IPF."
      />

      <div
        className="flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-surface p-0.5 sm:w-fit"
        role="tablist"
        aria-label="Secciones de normativa"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 whitespace-nowrap",
              // Pestañas segmentadas, como los pasos de la tarima.
              "min-h-9 rounded-md px-3 text-sm font-medium transition-colors focus-ring",
              tab === t.id
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "guide" && <AepGuidePanel />}

      {tab === "compensation" && <CompensationNormativaPanel />}

      {tab === "ipf" && (
        <>
          <div className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-muted" aria-hidden="true" />
              <input
                type="search"
                value={ipfQuery}
                onChange={(e) => setIpfQuery(e.target.value)}
                placeholder="Buscar en el Reglamento IPF…"
                aria-label="Buscar en el Reglamento IPF"
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-border-strong bg-surface pl-10 pr-10 text-sm text-foreground placeholder:text-subtle-muted focus-ring"
              />
              {ipfQuery && (
                <button
                  type="button"
                  onClick={() => setIpfQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-subtle-muted transition-colors hover:text-foreground focus-ring"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              {q ? (
                <p>
                  <span className="font-medium text-foreground-secondary">{ipfArticleCount}</span>{" "}
                  artículo{ipfArticleCount !== 1 ? "s" : ""} en{" "}
                  <span className="font-medium text-foreground-secondary">{ipfChapters.length}</span>{" "}
                  capítulo{ipfChapters.length !== 1 ? "s" : ""} coinciden con «{ipfQuery}»
                </p>
              ) : (
                <p>
                  <strong className="text-foreground-secondary">IPF Technical Rulebook</strong>:{" "}
                  {IPF_CHAPTERS.length} capítulos. Haz clic en un artículo para expandirlo.
                </p>
              )}
            </div>

            {ipfChapters.length === 0 && (
              <p className="py-6 text-sm text-muted-foreground">Sin resultados para «{ipfQuery}».</p>
            )}

            {/* Un capítulo es una sección con su h2, no una tarjeta: el
                reglamento se lee de corrido y las cajas apiladas solo
                añadían bordes. */}
            {ipfChapters.map((chapter) => {
              const isOpen = q ? true : openChapters.has(chapter.num);
              return (
                <section key={chapter.num} className="max-w-3xl border-t border-border-muted pt-3">
                  <h2>
                    <button
                      type="button"
                      onClick={() => toggleChapter(chapter.num)}
                      className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-hover focus-ring"
                      aria-expanded={isOpen}
                      aria-controls={`ipf-chapter-${chapter.num}`}
                    >
                      <span className="text-muted-foreground" aria-hidden="true">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                      <span className="text-base font-semibold text-foreground">
                        {q ? (
                          <HighlightText
                            text={`Capítulo ${chapter.num}: ${chapter.title}`}
                            query={ipfQuery.trim()}
                          />
                        ) : (
                          `Capítulo ${chapter.num}: ${chapter.title}`
                        )}
                      </span>
                      <span className="ml-auto shrink-0 text-sm text-muted-foreground">
                        {chapter.articles.length} art.
                      </span>
                    </button>
                  </h2>
                  {isOpen && (
                    <div id={`ipf-chapter-${chapter.num}`} className="mt-1 pb-2">
                      <IpfArticleList chapter={chapter} expandAll={!!q} query={q} />
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <footer className="max-w-prose space-y-1.5 border-t border-border-muted pt-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Fuente:{" "}
              <strong className="text-foreground-secondary">IPF Technical Rules (01/03/2026)</strong>
              {" · "}
              <strong className="text-foreground-secondary">AEP Reglamento de Competición 2026</strong>
              .
            </p>
            <p>
              <a
                href="https://www.powerlifting.sport/rules/codes/info/technical-rules"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-brand underline underline-offset-2 hover:text-primary-hover focus-ring"
              >
                powerlifting.sport → Rules → Technical Rules
              </a>
              {" · "}
              <a
                href="https://www.powerlifting.sport/federation/referees"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-brand underline underline-offset-2 hover:text-primary-hover focus-ring"
              >
                Referees IPF
              </a>
            </p>
            <p>
              Los niveles AEP (Regional, Nacional, IPF Cat. 2, IPF Cat. 1) corresponden a Nacional,
              Cat. II y Cat. I del sistema internacional IPF. Consulta la Guía AEP para estructura de
              campeonatos y marcas mínimas.
            </p>
          </footer>
        </>
      )}
    </PageShell>
  );
}
