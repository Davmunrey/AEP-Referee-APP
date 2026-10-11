import { notFound, redirect } from "next/navigation";
import { CompensationBoard } from "@/components/competitions/compensation-board";
import { canManageCompensation, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";

interface CompensationPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompensationPage({ params }: CompensationPageProps) {
  const user = await getSession();
  if (!user) return redirectSinAcceso();
  if (!canManageCompensation(user)) redirect("/competitions");

  const { id } = await params;
  // El resumen viene ya en el HTML: antes la pantalla se hidrataba vacía y lo
  // pedía a la API, que volvía a comprobar la sesión y a leer el campeonato
  // antes de calcularlo. Si falla aquí, el tablero lo pide como antes y
  // enseña el error en su sitio, sin tumbar la página entera.
  const [competition, initialSummary] = await Promise.all([
    dataService.getCompetition(id),
    dataService.getCompensationSummary(id).catch((err: unknown) => {
      console.error("[compensation.page]", err);
      return undefined;
    }),
  ]);
  if (!competition) notFound();

  return (
    <CompensationBoard
      competition={competition}
      canManage={canManageCompensation(user)}
      initialSummary={initialSummary}
    />
  );
}
