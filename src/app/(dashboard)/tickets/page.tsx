import type { Metadata } from "next";
import { TicketsBoard } from "@/components/tickets/tickets-board";
import { getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export const metadata: Metadata = {
  title: "Soporte — AEP Tarima",
};

export default async function TicketsPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const tickets = await dataService.getTickets({ user });

  return <TicketsBoard initialTickets={tickets} currentUser={user} />;
}
