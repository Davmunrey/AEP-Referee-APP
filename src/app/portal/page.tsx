import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { ConvocatoriaCard } from "@/components/portal/convocatoria-card";
import { DesignationCard } from "@/components/portal/designation-card";
import { convocatoriasParaJuez } from "@/server/convocatorias";
import { loadPortal } from "@/lib/portal-page";
import { formatDateRange } from "@/lib/utils";

export default async function PortalHomePage() {
  const { judge, data } = await loadPortal();
  const next = data.upcoming.slice(0, 2);
  const convocatorias = await convocatoriasParaJuez(judge.refereeId!);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">
          Hola, {judge.nombre.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.upcoming.length > 0
            ? `Tienes ${data.upcoming.length === 1 ? "1 campeonato designado" : `${data.upcoming.length} campeonatos designados`} próximamente.`
            : "No tienes designaciones próximas."}
        </p>
      </div>

      {data.activeSanction && (
        <div role="status" className="flex gap-3 rounded-xl border border-warning/30 bg-warning-muted px-4 py-3 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-foreground">
            Tienes una sanción activa hasta el {formatDateRange(data.activeSanction.fechaFin, data.activeSanction.fechaFin)}.
            Mientras dure no puedes apuntarte a convocatorias.
          </p>
        </div>
      )}

      <section aria-labelledby="proximas" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="proximas" className="text-[15px] font-semibold text-foreground">
            Próximas designaciones
          </h2>
          {data.upcoming.length > next.length && (
            <Link href="/portal/sesiones" className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground focus-ring">
              Ver todas <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
        </div>
        {next.length === 0 ? (
          <p className="surface-card rounded-xl px-4 py-6 text-center text-sm text-muted-foreground">
            Cuando una tarima en la que estés se apruebe, la verás aquí con tus sesiones y horarios.
          </p>
        ) : (
          next.map((item) => <DesignationCard key={item.competitionId} item={item} />)
        )}
      </section>

      <section aria-labelledby="convocatorias" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="convocatorias" className="text-[15px] font-semibold text-foreground">
            Convocatorias abiertas
          </h2>
          {convocatorias.length > 2 && (
            <Link href="/portal/convocatorias" className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground focus-ring">
              Ver todas <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
        </div>
        {convocatorias.length === 0 ? (
          <p className="surface-card rounded-xl px-4 py-6 text-center text-sm text-muted-foreground">
            No hay convocatorias abiertas para ti ahora mismo.
          </p>
        ) : (
          <div className="space-y-2.5">
            {convocatorias.slice(0, 2).map((item) => (
              <ConvocatoriaCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
