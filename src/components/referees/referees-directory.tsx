"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MoreHorizontal, Trash2, UserPlus } from "lucide-react";
import { NewRefereeDialog } from "@/components/referees/new-referee-dialog";
import { LevelBadge, StatusBadge } from "@/components/aep/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { selectFieldClassSm } from "@/lib/design-tokens";
import { api } from "@/lib/api/client";
import type { Referee, RefereeLevel, RefereeStatus, Zone } from "@/lib/types";

function zoneName(zones: Zone[], code: string) {
  return zones.find((z) => z.code === code)?.name ?? code;
}

interface RefereesDirectoryProps {
  initialReferees: Referee[];
  zones: Zone[];
  levels: RefereeLevel[];
  canEdit?: boolean;
}

export function RefereesDirectory({
  initialReferees,
  zones,
  levels,
  canEdit = false,
}: RefereesDirectoryProps) {
  const [referees, setReferees] = useState(initialReferees);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [filterZona, setFilterZona] = useState("TODAS");
  const [filterNivel, setFilterNivel] = useState("TODOS");
  const [filterEstado, setFilterEstado] = useState("TODOS");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const deleteReferee = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar al árbitro "${nombre}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(id);
    try {
      await api.deleteReferee(id);
      setReferees((prev) => prev.filter((r) => r.id !== id));
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

  useEffect(() => { setPage(1); }, [filterZona, filterNivel, filterEstado, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages);
  const rows = filtered.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-subtle-muted">
            {filtered.length < referees.length
              ? `${filtered.length} coincidencias · `
              : ""}
            {referees.length} árbitros en total
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Nuevo árbitro
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <Input
            type="search"
            placeholder="Buscar por nombre…"
            aria-label="Buscar árbitro por nombre"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-xs text-xs"
          />
          <div className="ml-auto flex flex-wrap gap-1.5">
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
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/80 text-left font-mono text-[10px] uppercase tracking-wider text-subtle-muted">
                  <th className="w-10 px-4 py-2" />
                  <th className="px-4 py-2 font-medium">Árbitro</th>
                  <th className="px-4 py-2 font-medium">Zona</th>
                  <th className="px-4 py-2 font-medium">Nivel</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 text-right font-medium">Eventos 2026</th>
                  <th className="px-4 py-2 font-medium">Último evento</th>
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
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <span className="font-mono text-[10px] text-subtle-muted">{referee.zona}</span>
                      <span className="ml-2">{zoneName(zones, referee.zona)}</span>
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
                          <Link href={`/referees/${referee.id}`} aria-label={`Ver ficha de ${referee.nombre}`}>
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
                  ? "No hay árbitros registrados aún."
                  : "Sin coincidencias. Ajusta los filtros."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
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

      <NewRefereeDialog
        zones={zones}
        levels={levels}
        open={showNew}
        onClose={() => setShowNew(false)}
      />
    </div>
  );
}
