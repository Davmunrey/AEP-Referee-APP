"use client";

import { useState } from "react";
import { LevelBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderRow,
  DataTableHeadCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { selectFieldClassSm } from "@/lib/design-tokens";
import type { EventType, IpfChapter, RegulationRule } from "@/lib/types";
import { IPF_CHAPTERS } from "@/lib/ipf-chapters";
import { BookOpen, FileText, ChevronDown, ChevronRight, Search, X } from "lucide-react";

const EVENT_TYPES: EventType[] = ["AEP-1", "AEP-2", "AEP-3"];

type Tab = "matrix" | "ipf";

function IpfArticleList({
  chapter,
  expandAll = false,
}: {
  chapter: IpfChapter;
  expandAll?: boolean;
}) {
  const [openArticles, setOpenArticles] = useState<Set<string>>(new Set());

  const toggle = (num: string) => {
    setOpenArticles((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  return (
    <div className="divide-y divide-border-muted">
      {chapter.articles.map((art) => {
        const isOpen = expandAll || openArticles.has(art.num);
        const label = art.title
          ? `Art. ${chapter.num}.${art.num} — ${art.title}`
          : `Art. ${chapter.num}.${art.num}`;
        return (
          <div key={art.num}>
            <button
              type="button"
              onClick={() => toggle(art.num)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
              aria-expanded={isOpen}
            >
              <span className="mt-0.5 shrink-0 text-primary">
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pl-10">
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground-secondary">
                  {art.text}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function RegulationsView({ rules }: { rules: RegulationRule[] }) {
  const [tab, setTab] = useState<Tab>("matrix");
  const [filterTipo, setFilterTipo] = useState<EventType | "TODOS">("TODOS");
  const [openChapters, setOpenChapters] = useState<Set<string>>(
    new Set(IPF_CHAPTERS.map((c) => c.num))
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

  const filtered =
    filterTipo === "TODOS"
      ? rules
      : rules.filter((r) => r.eventTypes.includes(filterTipo));

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
        title="Normativa IPF / AEP"
        description="Requisitos mínimos por rol y reglamento técnico IPF completo"
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-muted">
        <button
          type="button"
          onClick={() => setTab("matrix")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "matrix"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Matriz AEP
        </button>
        <button
          type="button"
          onClick={() => setTab("ipf")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "ipf"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Reglamento IPF
        </button>
      </div>

      {tab === "matrix" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border-muted pb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <CardTitle>Matriz rol → nivel mínimo</CardTitle>
            </div>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as EventType | "TODOS")}
              className={selectFieldClassSm}
              aria-label="Filtrar por tipo de evento"
            >
              <option value="TODOS">Todos los tipos</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable>
              <DataTableHead>
                <DataTableHeaderRow>
                  <DataTableHeadCell>Rol</DataTableHeadCell>
                  <DataTableHeadCell>Nivel mínimo</DataTableHeadCell>
                  <DataTableHeadCell>Tipos evento</DataTableHeadCell>
                  <DataTableHeadCell>Notas</DataTableHeadCell>
                </DataTableHeaderRow>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((r) => (
                  <DataTableRow key={r.id}>
                    <DataTableCell className="font-medium text-foreground">{r.rol}</DataTableCell>
                    <DataTableCell>
                      <LevelBadge level={r.minLevel} />
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs text-muted-foreground">
                      {r.eventTypes.join(", ")}
                    </DataTableCell>
                    <DataTableCell className="text-subtle-muted">{r.note}</DataTableCell>
                  </DataTableRow>
                ))}
                {filtered.length === 0 && (
                  <DataTableRow>
                    <DataTableCell colSpan={4} className="py-8 text-center text-xs text-subtle-muted">
                      Sin reglas para este tipo de evento.
                    </DataTableCell>
                  </DataTableRow>
                )}
              </DataTableBody>
            </DataTable>
          </CardContent>
        </Card>
      )}

      {tab === "ipf" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-subtle-muted">
              <strong className="text-foreground-secondary">IPF Technical Rulebook</strong>{" "}
              completo — {IPF_CHAPTERS.length} capítulos. Haz clic en un artículo para expandirlo.
            </p>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-muted" />
              <input
                type="search"
                value={ipfQuery}
                onChange={(e) => setIpfQuery(e.target.value)}
                placeholder="Buscar en el reglamento…"
                className="h-9 w-full rounded-xl border border-border-strong bg-surface pl-9 pr-8 text-sm text-foreground placeholder:text-subtle-muted focus-ring"
              />
              {ipfQuery && (
                <button
                  type="button"
                  onClick={() => setIpfQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle-muted hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {q && (
            <p className="text-xs text-subtle-muted">
              {ipfArticleCount} artículo(s) en {ipfChapters.length} capítulo(s) coinciden con
              «{ipfQuery}».
            </p>
          )}

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
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-primary">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                    <CardTitle className="text-sm">
                      Capítulo {chapter.num} — {chapter.title}
                    </CardTitle>
                    <span className="ml-auto text-xs text-subtle-muted">
                      {chapter.articles.length} artículos
                    </span>
                  </button>
                </CardHeader>
                {isOpen && (
                  <CardContent className="p-0 border-t border-border-muted">
                    <IpfArticleList chapter={chapter} expandAll={!!q} />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-border-muted bg-surface/50 px-4 py-3 text-xs leading-relaxed text-subtle-muted space-y-1">
        <p>
          Fuente:{" "}
          <strong className="text-foreground-secondary">IPF Technical Rules (01/03/2026)</strong>
          {" · "}
          <strong className="text-foreground-secondary">AEP Reglamento de Competición 2026</strong>.
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
          Los niveles AEP (Regional, Nacional, IPF Cat. 2, IPF Cat. 1) corresponden a Nacional, Cat. II y Cat. I del sistema internacional IPF.
        </p>
      </div>
    </PageShell>
  );
}
