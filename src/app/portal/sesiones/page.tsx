import { DesignationCard } from "@/components/portal/designation-card";
import { loadPortal } from "@/lib/portal-page";
import { formatDateRange } from "@/lib/utils";

export const metadata = { title: "Mis sesiones · Portal del juez" };

export default async function PortalSessionsPage() {
  const { data } = await loadPortal();
  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-semibold text-foreground">Mis sesiones</h1>

      <section aria-labelledby="proximas" className="space-y-3">
        <h2 id="proximas" className="text-[15px] font-semibold text-foreground">Próximas</h2>
        {data.upcoming.length === 0 ? (
          <p className="surface-card rounded-xl px-4 py-6 text-center text-sm text-muted-foreground">
            No tienes designaciones próximas.
          </p>
        ) : (
          data.upcoming.map((item) => <DesignationCard key={item.competitionId} item={item} respond />)
        )}
      </section>

      <section aria-labelledby="historial" className="space-y-3">
        <h2 id="historial" className="text-[15px] font-semibold text-foreground">Historial</h2>
        {data.past.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay campeonatos en tu historial.</p>
        ) : (
          <ul className="surface-card divide-y divide-border-muted overflow-hidden rounded-xl">
            {data.past.map((item) => (
              <li key={item.competitionId} className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">{item.competitionName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateRange(item.fecha, item.fechaFin)} · {item.tipo} ·{" "}
                  {[...new Set(item.sessions.flatMap((s) => s.roles))].join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
