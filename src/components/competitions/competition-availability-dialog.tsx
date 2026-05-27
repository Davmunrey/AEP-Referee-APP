"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import type { Referee, Zone } from "@/lib/types";
import { zoneUiName } from "@/lib/aep-zones";

interface CompetitionAvailabilityDialogProps {
  competitionId: string;
  referees: Referee[];
  zones: Zone[];
  confirmedIds: Set<string>;
  canEdit: boolean;
  onClose: () => void;
  onToggle: (refereeId: string, confirmed: boolean) => void;
}

export function CompetitionAvailabilityDialog({
  competitionId,
  referees,
  zones,
  confirmedIds,
  canEdit,
  onClose,
  onToggle,
}: CompetitionAvailabilityDialogProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = referees.filter(
    (r) =>
      r.estado === "Activo" &&
      (search === "" ||
        r.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (r.iniciales ?? "").toLowerCase().includes(search.toLowerCase())),
  );

  const toggle = (referee: Referee) => {
    if (!canEdit || pending) return;
    const wasConfirmed = confirmedIds.has(referee.id);
    setError(null);
    startTransition(async () => {
      try {
        if (wasConfirmed) {
          await api.removeCompetitionAvailability(competitionId, referee.id);
        } else {
          await api.addCompetitionAvailability(competitionId, referee.id);
        }
        onToggle(referee.id, !wasConfirmed);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-border bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-muted px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Disponibilidad confirmada</h2>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {confirmedIds.size} confirmados
          </span>
        </div>

        {/* Search */}
        <div className="border-b border-border-muted px-4 py-3">
          <Input
            placeholder="Buscar juez..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>

        {/* List */}
        <ul className="flex-1 overflow-y-auto divide-y divide-border-muted">
          {filtered.map((r) => {
            const confirmed = confirmedIds.has(r.id);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={!canEdit || pending}
                  onClick={() => toggle(r)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover disabled:opacity-50"
                >
                  {confirmed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-subtle-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{r.nombre}</p>
                    <p className="text-[11px] text-subtle-muted">
                      {zoneUiName(zones.find((z) => z.code === r.zona)?.code ?? r.zona)} · {r.nivel}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-subtle-muted">Sin resultados.</li>
          )}
        </ul>

        {error && <p className="px-4 py-2 text-xs text-destructive">{error}</p>}

        <div className="border-t border-border-muted px-4 py-3">
          <Button size="sm" variant="outline" onClick={onClose} className="w-full">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
