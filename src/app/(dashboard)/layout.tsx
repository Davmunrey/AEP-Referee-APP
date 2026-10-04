import { AppShell } from "@/components/layout/app-shell";
import { getSession, redirectSinAcceso } from "@/lib/auth/session";
import { afterResponse } from "@/lib/after-response";
import { dataService } from "@/server/services";
import { revisarConvocatorias } from "@/server/convocatorias";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const [navCounts, notificaciones] = await Promise.all([
    dataService.getNavCounts(user),
    // La campana no puede tumbar la página: sin avisos, se pinta vacía.
    dataService.getBandejaNotificaciones(user.id).catch((err) => {
      console.error("[layout.notificaciones]", err);
      return { items: [], sinLeer: 0 };
    }),
  ]);
  // Ampliaciones automáticas y recordatorios de cierre, después de responder.
  afterResponse(() => revisarConvocatorias());

  return (
    <AppShell currentUser={user} navCounts={navCounts} notificaciones={notificaciones}>
      {children}
    </AppShell>
  );
}
