import { notFound, redirect } from "next/navigation";
import { CompensationBoard } from "@/components/competitions/compensation-board";
import { canManageCompensation, getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";

interface CompensationPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompensationPage({ params }: CompensationPageProps) {
  const user = await getSession();
  if (!user) redirect("/sign-in");
  if (!canManageCompensation(user)) redirect("/competitions");

  const { id } = await params;
  const competition = await dataService.getCompetition(id);
  if (!competition) notFound();

  return <CompensationBoard competition={competition} canManage={canManageCompensation(user)} />;
}
