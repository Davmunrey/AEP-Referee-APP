"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Trash2 } from "lucide-react";
import { EventStatusBadge, EventTypeBadge } from "@/components/aep/badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderRow,
  DataTableHeadCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api/client";
import { selectFieldClassSm } from "@/lib/design-tokens";
import { formatDateRange } from "@/lib/utils";
import type { Competition, EventStatus, EventType, UserRole } from "@/lib/types";
import { CalendarDays } from "lucide-react";

interface EventsTableProps {
  initialEvents: Competition[];
  role: UserRole;
  userZona?: string | null;
}

const EVENT_TYPES: EventType[] = ["AEP-1", "AEP-2", "AEP-3"];
const EVENT_STATUSES: EventStatus[] = ["Completo", "Incompleto", "Crítico", "Borrador"];
const PAGE_SIZE = 20;

export function EventsTable({ initialEvents, role, userZona }: EventsTableProps) {
  const [events, setEvents] = useState(initialEvents);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("TODOS");
  const [filterEstado, setFilterEstado] = useState("TODOS");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterTipo !== "TODOS" && e.tipo !== filterTipo) return false;
      if (filterEstado !== "TODOS" && e.estado !== filterEstado) return false;
      if (search && !e.nombre.toLowerCase().includes(search.toLowerCase()) && !e.sede.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [events, filterTipo, filterEstado, search]);

  useEffect(() => { setPage(1); }, [filterTipo, filterEstado, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE),
    [filtered, safeCurrentPage],
  );

  const canDelete = (event: Competition) => {
    if (role === "lectura") return false;
    if (role === "nacional") return true;
    return event.zona === userZona;
  };

  const deleteEvent = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(id);
    try {
      await api.deleteCompetition(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const hasFilters = search || filterTipo !== "TODOS" || filterEstado !== "TODOS";

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-muted p-4">
        <Input
          placeholder="Buscar campeonato o sede…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className={selectFieldClassSm}
          aria-label="Filtrar por tipo"
        >
          <option value="TODOS">Todos los tipos</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className={selectFieldClassSm}
          aria-label="Filtrar por estado"
        >
          <option value="TODOS">Todos los estados</option>
          {EVENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && (
          <span className="text-xs text-subtle-muted">
            {filtered.length} de {events.length}
          </span>
        )}
      </div>
      {pageRows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          className="m-6 border-none bg-transparent"
          title={hasFilters ? "Sin coincidencias" : "Sin campeonatos"}
          description={hasFilters ? "Ajusta los filtros para ver resultados." : "Crea el primer campeonato con el botón Nuevo campeonato."}
        />
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableHeaderRow>
              <DataTableHeadCell>Campeonato</DataTableHeadCell>
              <DataTableHeadCell>Fecha</DataTableHeadCell>
              <DataTableHeadCell>Tipo</DataTableHeadCell>
              <DataTableHeadCell>Cobertura</DataTableHeadCell>
              <DataTableHeadCell>Estado</DataTableHeadCell>
              <DataTableHeadCell />
            </DataTableHeaderRow>
          </DataTableHead>
          <DataTableBody>
            {pageRows.map((event) => {
              const pct = event.requeridos > 0 ? Math.round((event.confirmados / event.requeridos) * 100) : 0;
              return (
                <DataTableRow key={event.id} className="group">
                  <DataTableCell>
                    <p className="font-medium text-foreground">{event.nombre}</p>
                    <p className="text-xs text-subtle-muted">{event.sede}</p>
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs text-muted-foreground">
                    {formatDateRange(event.fecha, event.fechaFin)}
                  </DataTableCell>
                  <DataTableCell>
                    <EventTypeBadge tipo={event.tipo} />
                  </DataTableCell>
                  <DataTableCell className="min-w-[140px]">
                    <Progress value={pct} />
                    <p className="mt-1 text-[11px] text-subtle-muted">
                      {event.confirmados}/{event.requeridos} · {pct}%
                    </p>
                  </DataTableCell>
                  <DataTableCell>
                    <EventStatusBadge status={event.estado} />
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/events/${event.id}`}>
                          Tarima
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {canDelete(event) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          disabled={deletingId === event.id}
                          onClick={() => void deleteEvent(event.id, event.nombre)}
                          aria-label={`Eliminar ${event.nombre}`}
                        >
                          {deletingId === event.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t border-border px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            disabled={safeCurrentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs text-subtle-muted">
            {safeCurrentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
