import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { getJudgeSession, getSession } from "@/lib/auth/session";
import { SIGN_IN_SIN_ACCESO } from "@/lib/auth/sign-in-redirect";

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
  return (
    <PortalShell nombre={judge.nombre} iniciales={judge.iniciales}>
      {children}
    </PortalShell>
  );
}
