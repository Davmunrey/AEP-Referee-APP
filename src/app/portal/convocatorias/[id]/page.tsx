import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ConvocatoriaSignup } from "@/components/portal/convocatoria-signup";
import { zoneUiName } from "@/lib/aep-zones";
import { loadPortal } from "@/lib/portal-page";
import { formatDateRange } from "@/lib/utils";
import { convocatoriaParaJuez } from "@/server/convocatorias";

export const metadata = { title: "Convocatoria · Portal del juez" };

export default async function PortalCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { judge } = await loadPortal();
  const { id } = await params;
  const item = await convocatoriaParaJuez(judge.refereeId!, id);
  if (!item) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/portal/convocatorias"
        className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground focus-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Convocatorias
      </Link>
      <div>
        <h1 className="text-heading font-semibold leading-tight text-foreground">{item.competitionName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDateRange(item.fecha, item.fechaFin)} · {item.tipo} · {item.sede}
          {item.zona ? ` · ${zoneUiName(item.zona)}` : ""}
        </p>
      </div>
      {item.mensaje && (
        <div className="surface-card rounded-xl px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Mensaje del delegado</p>
          <p className="mt-1 whitespace-pre-line text-sm text-foreground">{item.mensaje}</p>
        </div>
      )}
      <ConvocatoriaSignup initial={item} />
    </div>
  );
}
