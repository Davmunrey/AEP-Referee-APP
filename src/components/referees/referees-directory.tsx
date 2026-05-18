"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { JudgesRegistryImportButton } from "@/components/referees/judges-registry-import";
import { NewRefereeDialog } from "@/components/referees/new-referee-dialog";
import { LevelBadge, StatusBadge } from "@/components/aep/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { selectFieldClassSm } from "@/lib/design-tokens";
import { api } from "@/lib/api/client";
import { zoneUiName } from "@/lib/aep-zones";
import type { Referee, RefereeLevel, RefereeStatus, Zone } from "@/lib/types";

function zoneName(zones: Zone[], code: string) {
  return zoneUiName(zones.find((z) => z.code === code)?.code ?? code);
}

interface RefereesDirectoryProps {
  initialReferees: Referee[];
  zones: Zone[];
  levels: RefereeLevel[];
  canEdit?: boolean;
  canImport?: boolean;
}

export function RefereesDirectory({
  initialReferees,
  zones,
  levels,
  canEdit = false,
  canImport = false,
}: RefereesDirectoryProps) {
  const searchParams = useSearchParams();
  const [referees, setReferees] = useState(initialReferees);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filterZona, setFilterZona] = useState("TODAS");
  const [filterNivel, setFilterNivel] = useState("TODOS");
  const [filterEstado, setFilterEstado] = useState("TODOS");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const hasActiveFilters: boolean =
    filterZona !== "TODAS" ||
    filterNivel !== "TODOS" ||
    filterEstado !== "TODOS" ||
    !!search;

  const clearFilters = () => {
    setSearch("");
    setFilterZona("TODAS");
    setFilterNivel("TODOS");
    setFilterEstado("TODOS");
  };

  useEffect(() => {
    if (!deleteError) return;
    const t = setTimeout(() => setDeleteError(null), 5000);
    return () => clearTimeout(t);
  }, [deleteError]);

  const deleteReferee = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar al juez "${nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(id);
    try {
      await api.deleteReferee(id);
      setReferees((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    return referees.filter((a) => {
      if (filterZona !== "TODAS" && a.zona !== filterZona) return false;
      if (filterNivel !== "TODOS" && a.nivel !== filterNivel) return false;
      if (filterEstado !== "TODOS" && a.estado !== filterEstado) return false;
      if (search && !a.nombre.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [referees, filterZona, filterNivel, filterEstado, search]);

  useEffect(() => {
    setPage(1);
  }, [filterZona, filterNivel, filterEstado, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages);
  const rows = filtered.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  const getPageNumbers = (): number[] => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safeCurrentPage <= 3) return [1, 2, 3, 4, 5];
    if (safeCurrentPage >= totalPages - 2)
      return [
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    return [
      safeCurrentPage - 2,
      safeCurrentPage - 1,
      safeCurrentPage,
      safeCurrentPage + 1,
      safeCurrentPage + 2,
    ];
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-subtle-muted">
          {filtered.length < referees.length
            ? `${filtered.length} de ${referees.length} jueces`
            : `${referees.length} jueces en total`}
        </p>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs text-subtle-muted"
              onClick={clearFilters}
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </Button>
          )}
          {canImport && <JudgesRegistryImportButton />}
          {canEdit && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Nuevo juez
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-1.5 text-subtle-muted">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Filtros</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <Input
            type="search"
            placeholder="Buscar por nombre…"
            aria-label="Buscar juez por nombre"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-44 text-xs"
          />
          <select
            value={filterZona}
            onChange={(e) => setFilterZona(e.target.value)}
            className={selectFieldClassSm}
            aria-label="Filtrar por zona"
          >
            <option value="TODAS">Zona — Todas</option>
            {zones.map((z) => (
              <option key={z.code} value={z.code}>
                {z.name}
              </option>
            ))}
          </select>
          <select
            value={filterNivel}
            onChange={(e) => setFilterNivel(e.target.value)}
            className={selectFieldClassSm}
            aria-label="Filtrar por nivel"
          >
            <option value="TODOS">Nivel — Todos</option>
            {levels.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className={selectFieldClassSm}
            aria-label="Filtrar por estado"
          >
            <option value="TODOS">Estado — Todos</option>
            {(["Activo", "Inactivo", "Sancionado"] as RefereeStatus[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Mobile card list */}
        <div className="divide-y divide-border/50 md:hidden">
          {rows.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-subtle-muted">
              {referees.length === 0
                ? "No hay jueces registrados aún."
                : "Sin coincidencias. Ajusta los filtros."}
            </p>
          )}
          {rows.map((referee) => (
            <div key={referee.id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-xs font-semibold text-foreground-secondary">
                {referee.iniciales}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/referees/${referee.id}`}
                  className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                >
                  {referee.nombre}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <LevelBadge level={referee.nivel} />
                  <StatusBadge status={referee.estado} />
                  <span className="font-mono text-[10px] text-subtle-muted">{referee.zona}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                  <Link href={`/referees/${referee.id}`} aria-label={`Ver ficha de ${referee.nombre}`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Link>
                </Button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={deletingId === referee.id}
                    onClick={() => void deleteReferee(referee.id, referee.nombre)}
                    aria-label={`Eliminar ${referee.nombre}`}
                  >
                    {deletingId === referee.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <CardContent className="hidden p-0 md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/80 text-left font-mono text-[10px] uppercase tracking-wider text-subtle-muted">
                  <th className="w-10 px-4 py-2" />
                  <th className="px-4 py-2 font-medium">Juez</th>
                  <th className="px-4 py-2 font-medium">Localidad</th>
                  <th className="px-4 py-2 font-medium">Zona</th>
                  <th className="px-4 py-2 font-medium">Nivel</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 text-right font-medium">Competiciones 2026</th>
                  <th className="px-4 py-2 font-medium">Última competición</th>
                  <th className="w-12 px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((referee) => (
                  <tr
                    key={referee.id}
                    className="group border-b border-border/50 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong bg-muted text-xs font-semibold text-foreground-secondary">
                        {referee.iniciales}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <Link
                        href={`/referees/${referee.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {referee.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {referee.localidad ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {zoneName(zones, referee.zona)}
                    </td>
                    <td className="px-4 py-2.5">
                      <LevelBadge level={referee.nivel} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={referee.estado} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                      {referee.eventos}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10.5px] text-subtle-muted">
                      {referee.ultimo}
                    </td>
                    <td className="px-4 py-2.5 text-right opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link
                            href={`/referees/${referee.id}`}
                            aria-label={`Ver ficha de ${referee.nombre}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={deletingId === referee.id}
                            onClick={() => void deleteReferee(referee.id, referee.nombre)}
                            aria-label={`Eliminar ${referee.nombre}`}
                          >
                            {deletingId === referee.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="px-4 py-12 text-center text-sm text-subtle-muted">
                {referees.length === 0
                  ? "No hay jueces registrados aún."
                  : "Sin coincidencias. Ajusta los filtros."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safeCurrentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            {getPageNumbers().map((pageNum) => (
              <Button
                key={pageNum}
                variant={safeCurrentPage === pageNum ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8 text-xs"
                onClick={() => setPage(pageNum)}
                aria-label={`Página ${pageNum}`}
                aria-current={safeCurrentPage === pageNum ? "page" : undefined}
              >
                {pageNum}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-xs text-subtle-muted">
            {safeCurrentPage} / {totalPages}
          </span>
        </div>
      )}

      {deleteError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
        >
          <span>{deleteError}</span>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setDeleteError(null)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <NewRefereeDialog
        zones={zones}
        levels={levels}
        open={showNew}
        onClose={() => setShowNew(false)}
      />
    </div>
  );
}
