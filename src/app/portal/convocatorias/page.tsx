import { ConvocatoriaCard } from "@/components/portal/convocatoria-card";
import { loadPortal } from "@/lib/portal-page";
import { convocatoriasParaJuez } from "@/server/convocatorias";

export const metadata = { title: "Convocatorias · Portal del juez" };

export default async function PortalCallsPage() {
  const { judge } = await loadPortal();
  const list = await convocatoriasParaJuez(judge.refereeId!);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-heading font-semibold text-foreground">Convocatorias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apúntate a cada sesión a la que puedas ir. Tu delegado monta la tarima con los inscritos.
        </p>
      </div>
      {list.length === 0 ? (
        <p className="surface-card rounded-xl px-4 py-6 text-center text-sm text-muted-foreground">
          No hay convocatorias abiertas para ti ahora mismo. Cuando tu delegado lance una, aparecerá aquí.
        </p>
      ) : (
        <div className="space-y-2.5">
          {list.map((item) => (
            <ConvocatoriaCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
