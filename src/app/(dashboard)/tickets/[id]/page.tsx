import { notFound, redirect } from "next/navigation";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";

interface TicketPageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: TicketPageProps) {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const ticket = await dataService.getTicket(id, user);
  if (!ticket) notFound();

  return <TicketDetail initialTicket={ticket} currentUser={user} />;
}
