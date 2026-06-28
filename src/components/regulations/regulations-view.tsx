"use client";

import { useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AepGuidePanel } from "@/components/regulations/aep-guide-panel";
import { RosterRulesPanel } from "@/components/regulations/roster-rules-panel";
import { AEP_GUIDE_META } from "@/lib/aep-guide-2026";
import type { IpfChapter, RegulationRule } from "@/lib/types";
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
            className="rounded-sm bg-warning/25 px-0.5 font-medium text-foreground not-italic"
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
                className="flex flex-1 items-start gap-3 px-4 py-3 text-left transition-colors focus-ring hover:bg-surface-hover"
                aria-expanded={isOpen}
                aria-controls={`${anchorId}-content`}
              >
                <span className="mt-0.5 shrink-0 text-primary" aria-hidden="true">
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
                className="flex shrink-0 items-center px-3 opacity-0 transition-opacity group-hover:opacity-100 focus-ring"
              >
                {copiedId === anchorId ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Link2 className="h-3.5 w-3.5 text-subtle-muted" />
                )}
              </button>
            </div>
            {isOpen && (
              <div id={`${anchorId}-content`} className="px-4 pb-4 pl-10">
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground-secondary">
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

type RegulationsTab = "guide" | "roster" | "ipf";

const TABS: { id: RegulationsTab; label: string }[] = [
  { id: "guide", label: `Guía AEP ${AEP_GUIDE_META.season}` },
  { id: "roster", label: "Plazas en tarima" },
  { id: "ipf", label: "Reglamento IPF" },
];

export function RegulationsView({ rosterRules }: { rosterRules: RegulationRule[] }) {
  const [tab, setTab] = useState<RegulationsTab>("guide");
  const [openChapters, setOpenChapters] = useState<Set<string>>(
    new Set(IPF_CHAPTERS.map((c) => c.num)),
  );
  const [ipfQuery, setIpfQuery] = useState("");

  const q = ipfQuery.trim().toLowerCase();
  const ipfChapters: IpfChapter[] = !q
    ? IPF_CHAPTERS
    : IPF_CHAPTERS.flatMap((c) => {
        const chapterMatch = `cap ${c.num} ${c.title}`.toLowerCase().includes(q);
        if (chapterMatch) return [c];
        const articles = c.articles.filter((a) =>
          `${c.num}.${a.num} ${a.title ?? ""} ${a.text}`.toLowerCase().includes(q),
        );
        return articles.length ? [{ ...c, articles }] : [];
      });
  const ipfArticleCount = ipfChapters.reduce((n, c) => n + c.articles.length, 0);

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
        eyebrow="Gestión"
        title="Normativa"
        description="Guía AEP, requisitos de plazas en tarima y reglamento técnico IPF."
      />

      <div
        className="flex flex-wrap gap-1 rounded-xl border border-border-muted bg-surface/60 p-1"
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
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-ring",
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground-secondary hover:bg-surface-hover",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "guide" && <AepGuidePanel />}

      {tab === "roster" && <RosterRulesPanel rules={rosterRules} />}

      {tab === "ipf" && (
        <>
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-muted" />
              <input
                type="search"
                value={ipfQuery}
                onChange={(e) => setIpfQuery(e.target.value)}
                placeholder="Buscar en el Reglamento IPF…"
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

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-subtle-muted">
              {q ? (
                <p>
                  <span className="font-medium text-foreground-secondary">{ipfArticleCount}</span>{" "}
                  artículo{ipfArticleCount !== 1 ? "s" : ""} en{" "}
                  <span className="font-medium text-foreground-secondary">{ipfChapters.length}</span>{" "}
                  capítulo{ipfChapters.length !== 1 ? "s" : ""} coinciden con «{ipfQuery}»
                </p>
              ) : (
                <p>
                  <strong className="text-foreground-secondary">IPF Technical Rulebook</strong> —{" "}
                  {IPF_CHAPTERS.length} capítulos. Haz clic en un artículo para expandirlo.
                </p>
              )}
            </div>

            {ipfChapters.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-subtle-muted">
                  Sin resultados para «{ipfQuery}».
                </CardContent>
              </Card>
            )}

            {ipfChapters.map((chapter) => {
              const isOpen = q ? true : openChapters.has(chapter.num);
              return (
                <Card key={chapter.num}>
                  <CardHeader className="p-0">
                    <button
                      type="button"
                      onClick={() => toggleChapter(chapter.num)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left focus-ring"
                      aria-expanded={isOpen}
                      aria-controls={`ipf-chapter-${chapter.num}`}
                    >
                      <span className="text-primary" aria-hidden="true">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                      <CardTitle className="text-sm">
                        {q ? (
                          <HighlightText
                            text={`Capítulo ${chapter.num} — ${chapter.title}`}
                            query={ipfQuery.trim()}
                          />
                        ) : (
                          `Capítulo ${chapter.num} — ${chapter.title}`
                        )}
                      </CardTitle>
                      <span className="ml-auto text-xs text-subtle-muted">
                        {chapter.articles.length} art.
                      </span>
                    </button>
                  </CardHeader>
                  {isOpen && (
                    <CardContent
                      id={`ipf-chapter-${chapter.num}`}
                      className="border-t border-border-muted p-0"
                    >
                      <IpfArticleList chapter={chapter} expandAll={!!q} query={q} />
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="space-y-1 rounded-xl border border-border-muted bg-surface/50 px-4 py-3 text-xs leading-relaxed text-subtle-muted">
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
                className="text-primary hover:underline"
              >
                powerlifting.sport → Rules → Technical Rules
              </a>
              {" · "}
              <a
                href="https://www.powerlifting.sport/federation/referees"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Referees IPF
              </a>
            </p>
            <p className="italic">
              Los niveles AEP (Regional, Nacional, IPF Cat. 2, IPF Cat. 1) corresponden a Nacional,
              Cat. II y Cat. I del sistema internacional IPF. Consulta la Guía AEP para estructura de
              campeonatos y marcas mínimas.
            </p>
          </div>
        </>
      )}
    </PageShell>
  );
}
