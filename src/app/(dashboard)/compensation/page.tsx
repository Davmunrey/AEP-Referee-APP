import { redirect } from "next/navigation";
import { CompensationHub } from "@/components/compensations/compensation-hub";
import { canManageCompensation, getSession } from "@/lib/auth/session";
import { SIGN_IN_SIN_ACCESO } from "@/lib/auth/sign-in-redirect";
import { dataService } from "@/server/services";

export default async function CompensationHubPage() {
  const user = await getSession();
  if (!user) redirect(SIGN_IN_SIN_ACCESO);
  if (!canManageCompensation(user)) redirect("/competitions");

  const hub = await dataService.getCompensationHub(user);

  return <CompensationHub initialHub={hub} />;
}
