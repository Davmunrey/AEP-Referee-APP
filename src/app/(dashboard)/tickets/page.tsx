import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TicketsBoard } from "@/components/tickets/tickets-board";
import { getSession } from "@/lib/auth/session";
import { SIGN_IN_SIN_ACCESO } from "@/lib/auth/sign-in-redirect";
import { dataService } from "@/server/services";

export const metadata: Metadata = {
  title: "Soporte — AEP Tarima",
};

export default async function TicketsPage() {
  const user = await getSession();
  if (!user) redirect(SIGN_IN_SIN_ACCESO);

  const tickets = await dataService.getTickets({ user });

  return <TicketsBoard initialTickets={tickets} currentUser={user} />;
}
