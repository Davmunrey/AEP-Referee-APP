import { zoneUiName } from "@/lib/aep-zones";
import { loadPortal } from "@/lib/portal-page";
import { formatDateRange } from "@/lib/utils";

export const metadata = { title: "Mi ficha · Portal del juez" };

export default async function PortalProfilePage() {
  const { data } = await loadPortal();
  const p = data.profile;
  const rows: [string, string | undefined][] = [
    ["Nombre", p.nombre],
    ["Zona", zoneUiName(p.zona)],
    ["Nivel", p.nivel],
    ["Estado", p.estado],
    ["Licencia", p.licencia],
    ["E-mail", p.email],
    ["Teléfono", p.telefono],
    ["Localidad", p.localidad],
    ["Juez desde", p.antiguedad ? formatDateRange(p.antiguedad, p.antiguedad) : undefined],
  ];
  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">Mi ficha</h1>
      <dl className="surface-card divide-y divide-border-muted overflow-hidden rounded-xl">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 px-4 py-2.5 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words text-foreground">{value || <span className="text-subtle">—</span>}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Estos datos son los del censo de jueces de la AEP. Si alguno no es correcto, avisa a tu delegado de zona para que
        lo cambie.
      </p>
    </div>
  );
}
