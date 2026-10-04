import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { getJudgeSession, getSession } from "@/lib/auth/session";
import { SIGN_IN_SIN_ACCESO } from "@/lib/auth/sign-in-redirect";
import { afterResponse } from "@/lib/after-response";
import { revisarConvocatorias } from "@/server/convocatorias";
import { dataService } from "@/server/services";

export const dynamic = "force-dynamic";

export const metadata = { title: "Portal del juez · AEP Tarima" };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const judge = await getJudgeSession();
  if (!judge) {
    // El personal de gestión tiene su panel; el portal habla siempre en
    // nombre de un juez y no tiene nada que enseñarle.
    if (await getSession()) redirect("/");
    redirect(SIGN_IN_SIN_ACCESO);
  }
  const notificaciones = await dataService.getBandejaNotificaciones(judge.id).catch((err) => {
    console.error("[portal.notificaciones]", err);
    return { items: [], sinLeer: 0 };
  });
  afterResponse(() => revisarConvocatorias());
  return (
    <PortalShell nombre={judge.nombre} iniciales={judge.iniciales} notificaciones={notificaciones}>
      {children}
    </PortalShell>
  );
}
