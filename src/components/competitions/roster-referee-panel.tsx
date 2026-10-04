"use client";

import { Dispatch, SetStateAction, useMemo } from "react";
import { contar } from "@/lib/plural";
import type { AssignmentsMap, Competition, FlagsMap, Referee, RefereeLevel, RegulationRule, RoleKey, RosterSession, Zone } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Sparkles, Users } from "lucide-react";
import { selectFieldClass } from "@/lib/design-tokens";
import { getAssignabilityReason, getOperationalBlock, getRecommendationWarning, rankRefereesForSlot } from "@/lib/roster-ui";
import { busyElsewhereLabel, type RefereeBusyMap } from "@/lib/roster-conflicts";
import { RefereeCard } from "./roster-referee-card";

interface RosterRefereePanelProps {
  referees: Referee[];
  assignedIds: Set<string>;
  canEdit: boolean;
  readOnly: boolean;
  selectedSlot: string | null;
  selectedSlotMeta: { sessionLabel: string; roleLabel: string; slotNumber: number } | null;
  confirmedIds: Set<string>;
  /** refereeId → campeonatos solapados en los que ya está asignado. */
  busyElsewhere: RefereeBusyMap;
  filterOnlyConfirmed: boolean;
  filterZona: string;
  filterNivel: string;
  search: string;
  zones: Zone[];
  levels: RefereeLevel[];
  isDragging: boolean;
  draggedId: string | null;
  competitionTipo: Competition["tipo"];
  competitionZona?: string;
  regulations: RegulationRule[];
  template: RosterSession[];
  assignments: AssignmentsMap;
  flags: FlagsMap;
  selectedRoleKey?: RoleKey;
  onSelectSlot: (key: string | null) => void;
  onAvailabilityOpen: () => void;
  onFilterZona: Dispatch<SetStateAction<string>>;
  onFilterNivel: Dispatch<SetStateAction<string>>;
  onSearch: Dispatch<SetStateAction<string>>;
  onFilterConfirmed: Dispatch<SetStateAction<boolean>>;
  /**
   * Convocatoria del campeonato: quién se apuntó a la sesión que se está
   * montando (la del hueco elegido o la sesión activa). `null` si no hay.
   */
  inscritos?: { ids: Set<string>; sessionLabel: string } | null;
  filterOnlyInscritos?: boolean;
  onFilterInscritos?: Dispatch<SetStateAction<boolean>>;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onQuickAssign: (id: string) => void;
  /** Jueces de baja o marcados como no disponibles: nunca se listan. */
  hiddenUnavailableCount?: number;
  onClearFilters?: () => void;
}

export function RosterRefereePanelLeft({
  referees,
  assignedIds,
  canEdit,
  readOnly,
  selectedSlot,
  selectedSlotMeta,
  confirmedIds,
  busyElsewhere,
  filterOnlyConfirmed,
  filterZona,
  filterNivel,
  search,
  zones,
  levels,
  isDragging,
  draggedId,
  competitionTipo,
  competitionZona,
  regulations,
  template,
  assignments,
  flags,
  selectedRoleKey,
  onSelectSlot,
  onAvailabilityOpen,
  onFilterZona,
  onFilterNivel,
  onSearch,
  onFilterConfirmed,
  inscritos = null,
  filterOnlyInscritos = false,
  onFilterInscritos,
  onDragStart,
  onDragEnd,
  onQuickAssign,
  hiddenUnavailableCount = 0,
  onClearFilters,
}: RosterRefereePanelProps) {
  const busyElsewhereIds = useMemo(
    () => new Set(Object.keys(busyElsewhere)),
    [busyElsewhere],
  );

  // Selección rápida: al elegir un hueco, ordena los jueces por idoneidad
  // (elegibles y disponibles de la misma zona/nivel arriba; inasignables al fondo).
  const rankedReferees = useMemo(() => {
    if (readOnly || !selectedSlot || !selectedRoleKey) return referees;
    return rankRefereesForSlot(referees, {
      slotKey: selectedSlot,
      roleKey: selectedRoleKey,
      eventType: competitionTipo,
      competitionZona,
      template,
      assignments,
      flags,
      regulations,
      confirmedIds,
      assignedIds,
      busyElsewhereIds,
    });
  }, [
    referees,
    readOnly,
    selectedSlot,
    selectedRoleKey,
    competitionTipo,
    competitionZona,
    template,
    assignments,
    flags,
    regulations,
    confirmedIds,
    assignedIds,
    busyElsewhereIds,
  ]);
  // Los que se apuntaron a esta sesión, arriba (sin alterar el orden entre
  // ellos ni entre los demás): son la primera opción del delegado.
  const orderedReferees = useMemo(() => {
    if (!inscritos || inscritos.ids.size === 0) return rankedReferees;
    return [
      ...rankedReferees.filter((r) => inscritos.ids.has(r.id)),
      ...rankedReferees.filter((r) => !inscritos.ids.has(r.id)),
    ];
  }, [rankedReferees, inscritos]);
  const suggestionsActive = !readOnly && !!selectedSlot && !!selectedRoleKey;
  const filtersActive =
    filterZona !== "TODAS" || filterNivel !== "TODOS" || search.trim() !== "" || filterOnlyConfirmed;

  // Precalcula bloqueo/aviso por fila una sola vez por cambio real de inputs.
  // Antes se hacía getOperationalBlock/getAssignabilityReason (~90×) en cada
  // render del padre — incluido cada frame de arrastre (draggedId/isDragging).
  const rowMeta = useMemo(() => {
    const map = new Map<string, { blockedReason: string | null; warningReason: string | null }>();
    if (!selectedRoleKey || !selectedSlot) return map;
    for (const referee of orderedReferees) {
      const opBlock = getOperationalBlock({
        template,
        assignments,
        slotKey: selectedSlot,
        refereeId: referee.id,
        flags,
      });
      const blockedReason =
        getAssignabilityReason(referee, selectedRoleKey, competitionTipo, regulations) ??
        (opBlock && !opBlock.overridable ? opBlock.reason : null);
      const warningReason = !blockedReason
        ? opBlock?.overridable
          ? opBlock.reason
          : getRecommendationWarning(referee, selectedRoleKey, competitionTipo, regulations)
        : null;
      map.set(referee.id, { blockedReason, warningReason });
    }
    return map;
  }, [
    orderedReferees,
    selectedRoleKey,
    selectedSlot,
    template,
    assignments,
    flags,
    competitionTipo,
    regulations,
  ]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden border-r border-border">
      <div className="border-b border-border px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-foreground-secondary">Jueces</h2>
          <span className="text-[11px] text-subtle-muted">
            {referees.length} · {referees.filter((r) => assignedIds.has(r.id)).length} en sesión
          </span>
        </div>
        {selectedSlot && !readOnly && (
          <p className="mt-0.5 truncate text-[11px] font-medium text-primary">
            {selectedSlotMeta
              ? `${selectedSlotMeta.sessionLabel} · ${selectedSlotMeta.roleLabel} ${selectedSlotMeta.slotNumber}`
              : "Hueco seleccionado"}
          </p>
        )}
        {suggestionsActive && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-subtle-muted">
            <Sparkles className="h-2.5 w-2.5 text-primary" />
            {confirmedIds.size > 0
              ? "Solo disponibles · ordenados por idoneidad"
              : "Ordenados por idoneidad para el hueco"}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {canEdit && (
            <button
              type="button"
              onClick={onAvailabilityOpen}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-foreground-secondary transition-[color,background-color,border-color,scale] duration-100 ease-(--ease-out) hover:bg-surface-hover active:scale-95 focus-ring"
            >
              <Users className="h-3 w-3" />
              Disp.
              {confirmedIds.size > 0 && (
                <span className="rounded-full bg-success/20 px-1 text-[11px] font-semibold text-success">
                  {confirmedIds.size}
                </span>
              )}
            </button>
          )}
          {confirmedIds.size > 0 && (
            <button
              type="button"
              onClick={() => onFilterConfirmed((v) => !v)}
              // El foco visible estaba solo en la rama inactiva: al activarlo, el
              // botón desaparecía del recorrido de teclado. `focus-ring` va en la
              // base, que es donde no depende del estado.
              className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-[color,background-color,border-color,scale] duration-100 ease-(--ease-out) active:scale-95 focus-ring ${filterOnlyConfirmed ? "border-success/40 bg-success/10 text-success" : "border-border text-subtle-muted hover:bg-surface-hover"}`}
            >
              Confirmados
            </button>
          )}
          {inscritos && onFilterInscritos && (
            <button
              type="button"
              onClick={() => onFilterInscritos((v) => !v)}
              aria-pressed={filterOnlyInscritos}
              title={`Solo los que se apuntaron a ${inscritos.sessionLabel} en la convocatoria`}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-[color,background-color,border-color,scale] duration-100 ease-(--ease-out) active:scale-95 focus-ring ${filterOnlyInscritos ? "border-info/40 bg-info-muted text-info" : "border-border text-subtle-muted hover:bg-surface-hover"}`}
            >
              Inscritos
              <span className="tabular-nums">{inscritos.ids.size}</span>
            </button>
          )}
          {selectedSlot && !readOnly && (
            <button
              type="button"
              onClick={() => onSelectSlot(null)}
              className="rounded-md border border-primary/25 px-2 py-1.5 text-[11px] text-primary transition-[color,background-color,border-color,scale] duration-100 ease-(--ease-out) hover:bg-primary/5 active:scale-95 focus-ring"
            >
              Cancelar hueco
            </button>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Input
            placeholder="Buscar…"
            aria-label="Buscar juez por nombre"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="col-span-2 h-8 text-xs"
          />
          <select
            value={filterZona}
            onChange={(e) => onFilterZona(e.target.value)}
            className={`${selectFieldClass} h-8 text-xs`}
            aria-label="Filtrar por zona"
          >
            <option value="TODAS">Todas zonas</option>
            {zones.map((z) => (
              <option key={z.code} value={z.code}>
                {z.name}
              </option>
            ))}
          </select>
          <select
            value={filterNivel}
            onChange={(e) => onFilterNivel(e.target.value)}
            className={`${selectFieldClass} h-8 text-xs`}
            aria-label="Filtrar por nivel"
          >
            <option value="TODOS">Todos niveles</option>
            {levels.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ul className="space-y-0.5 p-1.5">
          {orderedReferees.map((referee) => {
            // Bloqueo duro (nivel/normativa o conflicto no forzable) → no asignable.
            // Conflicto forzable (solape) → aviso, sigue siendo asignable (confirma al asignar).
            const meta = rowMeta.get(referee.id);
            const blockedReason = meta?.blockedReason ?? null;
            const warningReason = meta?.warningReason ?? null;
            return (
              <RefereeCard
                key={referee.id}
                zones={zones}
                referee={referee}
                assigned={assignedIds.has(referee.id)}
                dragging={draggedId === referee.id}
                blockedReason={blockedReason}
                warningReason={warningReason}
                busyReason={busyElsewhereLabel(busyElsewhere[referee.id])}
                competitionZona={competitionZona}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onClick={onQuickAssign}
                highlight={!!selectedSlot && !readOnly}
                isDragging={isDragging}
                readOnly={readOnly}
                isConfirmed={confirmedIds.has(referee.id)}
                isInscrito={inscritos?.ids.has(referee.id) ?? false}
              />
            );
          })}
          {referees.length === 0 && (
            <li className="py-8 text-center text-xs text-subtle-muted">
              {suggestionsActive && confirmedIds.size > 0
                ? "Ningún juez disponible para este hueco. Revisa la disponibilidad o ajusta los filtros."
                : "Sin coincidencias. Ajusta los filtros."}
              {filtersActive && onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="mx-auto mt-2 block rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground-secondary hover:bg-surface-hover focus-ring"
                >
                  Quitar filtros
                </button>
              )}
            </li>
          )}
        </ul>
      </div>

      <div className="hidden border-t border-border px-2 py-1 sm:block">
        {/* Sin este aviso, un juez dado de baja o marcado «no disponible» en su
            ficha simplemente no aparecía y no había forma de saber por qué. */}
        {hiddenUnavailableCount > 0 && (
          <p className="truncate text-[11px] text-subtle-muted" title="Los jueces de baja o marcados como no disponibles en su ficha no se pueden asignar.">
            {contar(hiddenUnavailableCount, "juez no disponible oculto", "jueces no disponibles ocultos")}
          </p>
        )}
        <p className="truncate text-[11px] text-subtle-muted" title="Arrastra un juez a un hueco, o selecciona hueco y juez.">
          Arrastra o clic hueco → juez
        </p>
      </div>
    </section>
  );
}
