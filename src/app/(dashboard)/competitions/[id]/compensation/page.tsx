import { notFound, redirect } from "next/navigation";
import { CompensationBoard } from "@/components/competitions/compensation-board";
import { canManageCompensation, getSession } from "@/lib/auth/session";
import { SIGN_IN_SIN_ACCESO } from "@/lib/auth/sign-in-redirect";
import { dataService } from "@/server/services";

interface CompensationPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompensationPage({ params }: CompensationPageProps) {
  const user = await getSession();
  if (!user) redirect(SIGN_IN_SIN_ACCESO);
  if (!canManageCompensation(user)) redirect("/competitions");

  const { id } = await params;
  const competition = await dataService.getCompetition(id);
  if (!competition) notFound();

  return <CompensationBoard competition={competition} canManage={canManageCompensation(user)} />;
}
