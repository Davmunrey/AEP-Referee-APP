import { RegulationsView } from "@/components/regulations/regulations-view";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { redirect } from "next/navigation";

export default async function RegulationsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const rules = await dataService.getRegulations();
  return <RegulationsView rules={rules} />;
}
