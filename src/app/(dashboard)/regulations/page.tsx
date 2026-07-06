import { RegulationsView } from "@/components/regulations/regulations-view";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function RegulationsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  return <RegulationsView />;
}
