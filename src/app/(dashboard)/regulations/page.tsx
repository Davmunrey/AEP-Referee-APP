import { RegulationsView } from "@/components/regulations/regulations-view";
import { getSession, redirectSinAcceso } from "@/lib/auth/session";

export default async function RegulationsPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  return <RegulationsView />;
}
