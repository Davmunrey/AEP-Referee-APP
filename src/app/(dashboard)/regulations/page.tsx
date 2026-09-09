import { RegulationsView } from "@/components/regulations/regulations-view";
import { getSession } from "@/lib/auth/session";
import { SIGN_IN_SIN_ACCESO } from "@/lib/auth/sign-in-redirect";
import { redirect } from "next/navigation";

export default async function RegulationsPage() {
  const user = await getSession();
  if (!user) redirect(SIGN_IN_SIN_ACCESO);

  return <RegulationsView />;
}
