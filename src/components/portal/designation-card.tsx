import { DesignationResponse } from "@/components/portal/designation-response";
import type { PortalDesignation } from "@/lib/judge-portal";
import { formatDateRange } from "@/lib/utils";

/** Un campeonato en el que el juez está designado, sesión a sesión. */
export function DesignationCard({ item, respond = false }: { item: PortalDesignation; respond?: boolean }) {
  return (
    <article className="surface-card overflow-hidden rounded-xl">
      <header className="border-b border-border-muted px-4 py-3">
        <h3 className="text-[15px] font-semibold text-foreground">{item.competitionName}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDateRange(item.fecha, item.fechaFin)} · {item.tipo} · {item.sede}
        </p>
      </header>
      <ul className="divide-y divide-border-muted">
        {item.sessions.map((s) => (
          <li key={s.session} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-medium text-foreground">
                {s.dia ? `${s.dia} · ` : ""}
                {s.nombre}
              </p>
              {s.horarioCompeticion && (
                <p className="text-xs tabular-nums text-muted-foreground">Competición {s.horarioCompeticion}</p>
              )}
            </div>
            <p className="mt-1 text-xs text-foreground-secondary">{s.roles.join(" · ")}</p>
            {s.horarioPesaje && (
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">Pesaje {s.horarioPesaje}</p>
            )}
          </li>
        ))}
      </ul>
      {respond && <DesignationResponse competitionId={item.competitionId} initial={item.respuesta} />}
    </article>
  );
}
