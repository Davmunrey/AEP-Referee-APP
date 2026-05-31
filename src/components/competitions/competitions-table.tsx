"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, FileText, Loader2, Trash2, X } from "lucide-react";
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
import { getApiBaseUrl } from "@/lib/api/config";
import { isCompetitionPast } from "@/lib/competition-status";
import { groupCompetitionDuplicates } from "@/lib/competition-dedup";
import { selectFieldClassSm } from "@/lib/design-tokens";
import { cn, formatDateRange } from "@/lib/utils";
import type { Competition, EventStatus, EventType, UserRole } from "@/lib/types";

interface CompetitionsTableProps {
  initialCompetitions: Competition[];
  role: UserRole;
  userZona?: string | null;
}

const EVENT_TYPES: EventType[] = ["AEP-1", "AEP-2", "AEP-3"];
const EVENT_STATUSES: EventStatus[] = ["Completo", "Incompleto", "Crítico", "Borrador"];
const PAGE_SIZE = 20;
const MAX_VISIBLE_PAGES = 5;

export function CompetitionsTable({ initialCompetitions, role, userZona }: CompetitionsTableProps) {
  const router = useRouter();
  const [competitions, setCompetitions] = useState(initialCompetitions);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("TODOS");
  const [filterEstado, setFilterEstado] = useState("TODOS");
  const [filterZona, setFilterZona] = useState(() =>
    role === "delegado_zona" && userZona ? userZona : "TODOS",
  );
  const [deduping, setDeduping] = useState(false);

  const zoneOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const e of competitions) {
      if (e.zona) codes.add(e.zona);
    }
    return [...codes].sort();
  }, [competitions]);

  useEffect(() => {
    setCompetitions(initialCompetitions);
  }, [initialCompetitions]);

  const duplicateGroups = useMemo(() => groupCompetitionDuplicates(competitions), [competitions]);
  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of duplicateGroups) {
      for (const e of g.competitions) ids.add(e.id);
    }
    return ids;
  }, [duplicateGroups]);
  const duplicateCount = duplicateGroups.reduce((n, g) => n + g.competitions.length - 1, 0);
  const canDedupe = role === "super_admin" || role === "delegado_jueces";

  const refreshEvents = async () => {
    const fresh = await api.getCompetitions();
    setCompetitions(fresh);
    router.refresh();
  };

  const filtered = useMemo(() => {
    return competitions.filter((e) => {
      if (filterTipo !== "TODOS" && e.tipo !== filterTipo) return false;
      if (filterEstado !== "TODOS" && e.estado !== filterEstado) return false;
      if (filterZona !== "TODOS" && e.zona !== filterZona) return false;
      if (
        search &&
        !e.nombre.toLowerCase().includes(search.toLowerCase()) &&
        !e.sede.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [competitions, filterTipo, filterEstado, filterZona, search]);

  useEffect(() => {
    setPage(1);
  }, [filterTipo, filterEstado, filterZona, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE),
    [filtered, safeCurrentPage],
  );

  const canDelete = (competition: Competition) => {
    if (role === "super_admin" || role === "delegado_jueces") return true;
    if (role === "delegado_zona") return competition.zona === userZona;
    return false;
  };

  const deleteEvent = async (id: string) => {
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await api.deleteCompetition(id);
      await refreshEvents();
    } catch (err) {
      alert(
        err instanceof Error
          ? `No se pudo eliminar: ${err.message}`
          : "No se pudo eliminar el campeonato.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const cleanDuplicates = async () => {
    if (
      !window.confirm(
        `¿Eliminar ${duplicateCount} campeonato(s) duplicado(s)? Se conserva el que tenga más tarima asignada.`,
      )
    ) {
      return;
    }
    setDeduping(true);
    try {
      const result = await api.removeCompetitionDuplicates();
      await refreshEvents();
      alert(`Listo: ${result.removed.length} eliminado(s), ${result.kept.length} conservado(s).`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudieron limpiar duplicados");
    } finally {
      setDeduping(false);
    }
  };

  const hasFilters =
    search ||
    filterTipo !== "TODOS" ||
    filterEstado !== "TODOS" ||
    filterZona !== "TODOS";

  const clearFilters = () => {
    setSearch("");
    setFilterTipo("TODOS");
    setFilterEstado("TODOS");
    setFilterZona(role === "delegado_zona" && userZona ? userZona : "TODOS");
  };

  const pageRange = useMemo(() => {
    const half = Math.floor(MAX_VISIBLE_PAGES / 2);
    let start = Math.max(1, safeCurrentPage - half);
    const end = Math.min(totalPages, start + MAX_VISIBLE_PAGES - 1);
    start = Math.max(1, end - MAX_VISIBLE_PAGES + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [safeCurrentPage, totalPages]);

  return (
    <div className="space-y-0">
      {/* Sticky filter row */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border-muted bg-card px-4 py-3 backdrop-blur-sm">
        <Input
          type="search"
          placeholder="Buscar campeonato o sede…"
          aria-label="Buscar campeonato o sede"
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
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {zoneOptions.length > 0 && (
          <select
            value={filterZona}
            onChange={(e) => setFilterZona(e.target.value)}
            className={selectFieldClassSm}
            aria-label="Filtrar por zona"
          >
            <option value="TODOS">Todas las zonas</option>
            {zoneOptions.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        )}
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className={selectFieldClassSm}
          aria-label="Filtrar por estado"
        >
          <option value="TODOS">Todos los estados</option>
          {EVENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {hasFilters && (
          <>
            <span className="ml-auto text-xs text-subtle-muted">
              {filtered.length} de {competitions.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={clearFilters}
            >
              <X className="h-3 w-3" />
              Limpiar
            </Button>
          </>
        )}
        {canDedupe && duplicateCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={deduping}
            onClick={() => void cleanDuplicates()}
          >
            {deduping ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Limpiar {duplicateCount} duplicado{duplicateCount !== 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {duplicateCount > 0 && (
        <p className="border-b border-warning-border/30 bg-warning-subtle px-4 py-2 text-xs text-warning">
          Hay {duplicateGroups.length} grupo(s) con el mismo nombre, fecha y tipo. Si borras uno y
          sigue saliendo, es un duplicado con otro id — usa «Limpiar duplicados».
        </p>
      )}

      {pageRows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          className="m-8 border-none bg-transparent"
          title={hasFilters ? "Sin coincidencias" : "Sin campeonatos"}
          description={
            hasFilters
              ? "Prueba con otros filtros o limpia la búsqueda."
              : "Aún no hay campeonatos en la temporada. Crea el primero con «Nuevo campeonato»."
          }
        />
      ) : (
        <>
        {/* Mobile card list */}
        <div className="divide-y divide-border/50 md:hidden">
          {pageRows.map((competition) => {
            const pct =
              competition.requeridos > 0
                ? Math.round((competition.confirmados / competition.requeridos) * 100)
                : 0;
            const isPast = isCompetitionPast(competition);
            const isConfirmingDelete = confirmDeleteId === competition.id;
            return (
              <div key={competition.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{competition.nombre}</p>
                    <p className="truncate text-xs text-subtle-muted">{competition.sede}</p>
                  </div>
                  <EventStatusBadge status={competition.estado} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <EventTypeBadge tipo={competition.tipo} />
                  <span className="font-mono">{formatDateRange(competition.fecha, competition.fechaFin)}</span>
                  {competition.zona && <span className="font-mono uppercase">· {competition.zona}</span>}
                  {isPast && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Solo lectura
                    </span>
                  )}
                </div>
                <div>
                  <Progress value={pct} />
                  <p className="mt-1 text-[11px] text-subtle-muted">
                    {competition.confirmados}/{competition.requeridos} · {pct}%
                  </p>
                </div>
                {isConfirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-destructive">¿Eliminar?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={deletingId === competition.id}
                      onClick={() => void deleteEvent(competition.id)}
                    >
                      {deletingId === competition.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Sí
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirmDeleteId(null)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" asChild>
                      <Link href={`/competitions/${competition.id}`}>
                        Montar tarima
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() =>
                        window.open(`${getApiBaseUrl()}/competitions/${competition.id}/roster/quadrant`, "_blank")
                      }
                      aria-label={`Cuadrante PDF de ${competition.nombre}`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    {canDelete(competition) && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        disabled={deletingId === competition.id}
                        onClick={() => setConfirmDeleteId(competition.id)}
                        aria-label={`Eliminar ${competition.nombre}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
        <DataTable>
          <DataTableHead>
            <DataTableHeaderRow>
              <DataTableHeadCell>Campeonato</DataTableHeadCell>
              <DataTableHeadCell>Fecha</DataTableHeadCell>
              <DataTableHeadCell>Tipo</DataTableHeadCell>
              <DataTableHeadCell>Zona</DataTableHeadCell>
              <DataTableHeadCell>Cobertura</DataTableHeadCell>
              <DataTableHeadCell>Estado</DataTableHeadCell>
              <DataTableHeadCell />
            </DataTableHeaderRow>
          </DataTableHead>
          <DataTableBody>
            {pageRows.map((competition) => {
              const pct =
                competition.requeridos > 0
                  ? Math.round((competition.confirmados / competition.requeridos) * 100)
                  : 0;
              const isConfirmingDelete = confirmDeleteId === competition.id;
              const isPast = isCompetitionPast(competition);
              return (
                <DataTableRow
                  key={competition.id}
                  className={cn(
                    "group transition-colors duration-150",
                    isConfirmingDelete && "bg-destructive/5",
                  )}
                >
                  <DataTableCell>
                    <p className="font-medium text-foreground">
                      {competition.nombre}
                      {isPast && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          Solo lectura
                        </span>
                      )}
                      {duplicateIds.has(competition.id) && (
                        <span className="ml-2 rounded bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">
                          Duplicado
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-subtle-muted">{competition.sede}</p>
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs text-muted-foreground">
                    {formatDateRange(competition.fecha, competition.fechaFin)}
                  </DataTableCell>
                  <DataTableCell>
                    <EventTypeBadge tipo={competition.tipo} />
                  </DataTableCell>
                  <DataTableCell className="font-mono text-[11px] uppercase text-muted-foreground">
                    {competition.zona ?? "—"}
                  </DataTableCell>
                  <DataTableCell className="min-w-[140px]">
                    <Progress value={pct} />
                    <p className="mt-1 text-[11px] text-subtle-muted">
                      {competition.confirmados}/{competition.requeridos} · {pct}%
                    </p>
                  </DataTableCell>
                  <DataTableCell>
                    <EventStatusBadge status={competition.estado} />
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    {isConfirmingDelete ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs text-destructive">¿Eliminar?</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          disabled={deletingId === competition.id}
                          onClick={() => void deleteEvent(competition.id)}
                        >
                          {deletingId === competition.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Sí, eliminar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                          onClick={() =>
                            window.open(
                              `${getApiBaseUrl()}/competitions/${competition.id}/roster/quadrant`,
                              "_blank",
                            )
                          }
                          aria-label={`Cuadrante PDF de ${competition.nombre}`}
                          title="Cuadrante PDF"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/competitions/${competition.id}`}>
                            Montar tarima
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        {canDelete(competition) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                            disabled={deletingId === competition.id}
                            onClick={() => setConfirmDeleteId(competition.id)}
                            aria-label={`Eliminar ${competition.nombre}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
        </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-border px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={safeCurrentPage <= 1}
            onClick={() => setPage(1)}
            aria-label="Primera página"
          >
            «
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={safeCurrentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          {pageRange.map((p) => (
            <Button
              key={p}
              variant={p === safeCurrentPage ? "default" : "outline"}
              size="sm"
              className="h-7 w-7 p-0 text-xs"
              onClick={() => setPage(p)}
              aria-current={p === safeCurrentPage ? "page" : undefined}
            >
              {p}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setPage(totalPages)}
            aria-label="Última página"
          >
            »
          </Button>
          <span className="ml-2 text-xs text-subtle-muted">
            Pág. {safeCurrentPage} de {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
