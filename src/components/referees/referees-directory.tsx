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
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { JudgesRegistryImportButton } from "@/components/referees/judges-registry-import";

const NewRefereeDialog = dynamic(
  () => import("@/components/referees/new-referee-dialog").then((m) => m.NewRefereeDialog),
  { ssr: false },
);
import { LevelBadge, StatusBadge } from "@/components/aep/badges";
import { displayUltimo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { selectFieldClassSm } from "@/lib/design-tokens";
import { api } from "@/lib/api/client";
import { zoneUiName } from "@/lib/aep-zones";
import { arbitrajeYears } from "@/lib/judges-registry/arbitraje-stats";
import type { Referee, RefereeLevel, RefereeStatus, Zone } from "@/lib/types";

const CENSO_ALL = "TODOS";

/** Años naturales con actividad de arbitraje presentes en el censo, desc. */
function censusYears(referees: Referee[]): number[] {
  const years = new Set<number>();
  for (const r of referees) {
    if (r.arbitrajeStatsByYear) {
      for (const y of arbitrajeYears(r.arbitrajeStatsByYear)) years.add(y);
    }
  }
  return [...years].sort((a, b) => b - a);
}

/** ¿El juez tuvo arbitrajes en ese año natural concreto? */
function activeInYear(referee: Referee, year: string): boolean {
  return (referee.arbitrajeStatsByYear?.[year]?.total ?? 0) > 0;
}

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
  // Re-sincroniza con los datos del servidor cuando cambian (p. ej. tras importar
  // el Excel maestro, que hace router.refresh()); si no, la tabla mostraría la
  // lista antigua hasta recargar la página. Igual que CompetitionsTable.
  useEffect(() => {
    setReferees(initialReferees);
  }, [initialReferees]);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filterZona, setFilterZona] = useState("TODAS");
  const [filterNivel, setFilterNivel] = useState("TODOS");
  const [filterEstado, setFilterEstado] = useState("TODOS");
  const [filterCenso, setFilterCenso] = useState(CENSO_ALL);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const yearOptions = useMemo(() => censusYears(referees), [referees]);

  const hasActiveFilters: boolean =
    filterZona !== "TODAS" ||
    filterNivel !== "TODOS" ||
    filterEstado !== "TODOS" ||
    filterCenso !== CENSO_ALL ||
    !!search;

  const clearFilters = () => {
    setSearch("");
    setFilterZona("TODAS");
    setFilterNivel("TODOS");
    setFilterEstado("TODOS");
    setFilterCenso(CENSO_ALL);
  };

  useEffect(() => {
    if (!deleteError) return;
    const t = setTimeout(() => setDeleteError(null), 5000);
    return () => clearTimeout(t);
  }, [deleteError]);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Alternar Activo ↔ Inactivo desde la fila, sin pasar por la ficha. El caso
  // «Sancionado» queda fuera: ese estado lo gobierna el flujo de sanciones y
  // la API lo bloquea igualmente.
  const toggleEstado = async (referee: { id: string; nombre: string; estado: string }) => {
    const nextEstado = referee.estado === "Activo" ? "Inactivo" : "Activo";
    setTogglingId(referee.id);
    try {
      // disp acompaña al estado (mismo criterio que el import del Excel):
      // inactivo ⇒ no disponible para designaciones.
      const updated = await api.updateReferee(referee.id, {
        estado: nextEstado as Referee["estado"],
        disp: nextEstado === "Activo",
      });
      setReferees((prev) => prev.map((r) => (r.id === referee.id ? { ...r, ...updated } : r)));
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : `No se pudo cambiar el estado de ${referee.nombre}`,
      );
    } finally {
      setTogglingId(null);
    }
  };

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
    const q = search.toLowerCase();
    return referees.filter((a) => {
      if (filterZona !== "TODAS" && a.zona !== filterZona) return false;
      if (filterNivel !== "TODOS" && a.nivel !== filterNivel) return false;
      if (filterEstado !== "TODOS" && a.estado !== filterEstado) return false;
      if (filterCenso !== CENSO_ALL && !activeInYear(a, filterCenso)) return false;
      if (q && !a.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [referees, filterZona, filterNivel, filterEstado, filterCenso, search]);

  useEffect(() => {
    setPage(1);
  }, [filterZona, filterNivel, filterEstado, filterCenso, search]);

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
          {yearOptions.length > 0 && (
            <select
              value={filterCenso}
              onChange={(e) => setFilterCenso(e.target.value)}
              className={selectFieldClassSm}
              aria-label="Filtrar por censo por año natural"
            >
              <option value={CENSO_ALL}>Censo — Histórico</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  Arbitró en {y}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Mobile card list */}
        <div className="divide-y divide-border-muted md:hidden">
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
                {canEdit && referee.estado !== "Sancionado" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={togglingId === referee.id}
                    onClick={() => void toggleEstado(referee)}
                    title={referee.estado === "Activo" ? "Marcar inactivo" : "Marcar activo"}
                    aria-label={
                      referee.estado === "Activo"
                        ? `Marcar inactivo a ${referee.nombre}`
                        : `Marcar activo a ${referee.nombre}`
                    }
                  >
                    {togglingId === referee.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : referee.estado === "Activo" ? (
                      <UserX className="h-3.5 w-3.5 text-warning" />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5 text-success" />
                    )}
                  </Button>
                )}
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
                {/* Mismo peso de cabecera que la tabla compartida (DataTable):
                    en una tabla de nueve columnas los títulos tienen que pesar
                    más que el dato para poder guiar la lectura. */}
                <tr className="border-b border-border/80 text-left font-mono text-[10px] uppercase tracking-wider text-subtle-muted">
                  <th className="w-10 px-4 py-2" />
                  <th className="px-4 py-2 font-semibold">Juez</th>
                  <th className="px-4 py-2 font-semibold">Localidad</th>
                  <th className="px-4 py-2 font-semibold">Zona</th>
                  <th className="px-4 py-2 font-semibold">Nivel</th>
                  <th className="px-4 py-2 font-semibold">Estado</th>
                  <th className="px-4 py-2 text-right font-semibold">Plazas (histórico)</th>
                  <th className="px-4 py-2 font-semibold">Última competición</th>
                  <th className="w-12 px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((referee) => (
                  <tr
                    key={referee.id}
                    className="group border-b border-border/50 transition-colors duration-100 hover:bg-muted/30"
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
                    {/* Las fechas son cifras: sin `tabular-nums` los dígitos
                        bailan de fila en fila y la columna deja de ser una
                        columna. */}
                    <td className="px-4 py-2.5 font-mono text-[11px] tabular-nums text-subtle-muted">
                      {displayUltimo(referee.ultimo)}
                    </td>
                    {/* En puntero grueso (tablet) no hay hover: las acciones se
                        quedarían invisibles para siempre. */}
                    <td className="px-4 py-2.5 text-right opacity-0 transition-opacity duration-100 group-hover:opacity-100 pointer-coarse:opacity-100 focus-within:opacity-100">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <Link
                            href={`/referees/${referee.id}`}
                            aria-label={`Ver ficha de ${referee.nombre}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canEdit && referee.estado !== "Sancionado" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={togglingId === referee.id}
                            onClick={() => void toggleEstado(referee)}
                            title={referee.estado === "Activo" ? "Marcar inactivo" : "Marcar activo"}
                            aria-label={
                              referee.estado === "Activo"
                                ? `Marcar inactivo a ${referee.nombre}`
                                : `Marcar activo a ${referee.nombre}`
                            }
                          >
                            {togglingId === referee.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : referee.estado === "Activo" ? (
                              <UserX className="h-3.5 w-3.5 text-warning" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5 text-success" />
                            )}
                          </Button>
                        )}
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
          className="flex items-center justify-between gap-3 rounded-lg border border-destructive-border bg-destructive-muted px-4 py-2.5 text-sm text-destructive"
        >
          <span>{deleteError}</span>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setDeleteError(null)}
            className="-m-1.5 shrink-0 rounded-md p-1.5 opacity-70 hover:opacity-100 focus-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showNew && (
        <NewRefereeDialog
          zones={zones}
          levels={levels}
          open
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
