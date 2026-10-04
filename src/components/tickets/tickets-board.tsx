"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MessageSquare, Plus } from "lucide-react";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SessionUser, SupportTicket, TicketCategory, TicketStatus } from "@/lib/types";
import {
  AttachmentThumb,
  CATEGORY_LABELS,
  CategoryBadge,
  relativeDate,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  TicketStatusPill,
} from "@/components/tickets/ticket-shared";
import { contar } from "@/lib/plural";

const NewTicketDialog = dynamic(
  () => import("@/components/tickets/new-ticket-dialog").then((m) => m.NewTicketDialog),
  { ssr: false },
);

type StatusFilter = "todos" | TicketStatus;
type CategoryFilter = "todos" | TicketCategory;

/**
 * Control segmentado: un raíl con las opciones y la activa levantada sobre
 * él. Sustituye a la fila de píldoras sueltas, que no se leían como un
 * control sino como etiquetas. En móvil desplaza en horizontal dentro de su
 * propio raíl en vez de desbordar la página.
 */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span id={id} className="w-20 shrink-0 text-sm text-muted-foreground">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={id}
        className="flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-surface p-0.5"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className={cn(
                "min-h-9 shrink-0 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-ring",
                // Activo en neutro: el rojo queda para «Nuevo ticket».
                active
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TicketsBoard({
  initialTickets,
  currentUser,
}: {
  initialTickets: SupportTicket[];
  currentUser: SessionUser;
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Re-sincroniza con el servidor tras router.refresh() (patrón competitions-table).
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  const filtered = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (statusFilter === "todos" || t.status === statusFilter) &&
          (categoryFilter === "todos" || t.categoria === categoryFilter),
      ),
    [tickets, statusFilter, categoryFilter],
  );

  const openCount = tickets.filter(
    (t) => t.status === "abierto" || t.status === "en_progreso",
  ).length;

  const isAdmin =
    currentUser.role === "super_admin" || currentUser.role === "delegado_jueces";
  const scopeNote = isAdmin
    ? "Vista de administración: todos los tickets"
    : "Tus tickets de soporte";

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Tickets de soporte"
          description={`${scopeNote} · ${tickets.length} en total · ${openCount} en curso`}
        />
        <Button onClick={() => setDialogOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo ticket
        </Button>
      </div>

      {/* Filtros: sin tickets no hay nada que filtrar. */}
      {tickets.length > 0 && (
        <div className="space-y-2.5">
          <Segmented<StatusFilter>
            label="Estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "todos", label: "Todos" },
              ...TICKET_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
            ]}
          />
          <Segmented<CategoryFilter>
            label="Categoría"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: "todos", label: "Todas" },
              ...TICKET_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
            ]}
          />
        </div>
      )}

      {/* Lista. El vacío es una frase, no una caja: la acción de crear ya
          está en la cabecera y repetirla aquí duplicaba el botón rojo. */}
      {tickets.length === 0 ? (
        <div className="max-w-prose py-6">
          <p className="text-sm font-medium text-foreground">Aún no hay tickets</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Abre uno con «Nuevo ticket» para reportar una incidencia o proponer una mejora.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="max-w-prose py-6">
          <p className="text-sm font-medium text-foreground">Sin resultados</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Ningún ticket coincide con los filtros seleccionados.
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => {
              setStatusFilter("todos");
              setCategoryFilter("todos");
            }}
          >
            Quitar filtros
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => {
            const photos = t.attachments.filter((a) => a.signedUrl);
            return (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-border-strong hover:bg-surface-hover focus-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge categoria={t.categoria} />
                      <TicketStatusPill status={t.status} />
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-foreground">
                      {t.titulo}
                    </p>
                    <p className="mt-1 text-2xs text-muted-foreground">
                      {t.createdByName} · {relativeDate(t.createdAt)}
                    </p>
                  </div>
                  <span
                    className="flex shrink-0 items-center gap-1 text-2xs text-muted-foreground"
                    aria-label={contar(t.commentCount, "comentario", "comentarios")}
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.commentCount}
                  </span>
                </div>

                {photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {photos.slice(0, 4).map((a) => (
                      <AttachmentThumb key={a.id} attachment={a} />
                    ))}
                    {photos.length > 4 && (
                      <span className="flex h-10 w-10 items-center justify-center rounded bg-muted text-2xs font-medium text-muted-foreground">
                        +{photos.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {dialogOpen && <NewTicketDialog onClose={() => setDialogOpen(false)} />}
    </PageShell>
  );
}
