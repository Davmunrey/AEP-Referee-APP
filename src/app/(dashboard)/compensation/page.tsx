import { redirect } from "next/navigation";
import { CompensationHub } from "@/components/compensations/compensation-hub";
import { canManageCompensation, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export default async function CompensationHubPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();
  if (!canManageCompensation(user)) redirect("/competitions");

  const hub = await dataService.getCompensationHub(user);

  return <CompensationHub initialHub={hub} />;
}
