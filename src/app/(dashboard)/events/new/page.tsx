import Link from "next/link";
import { NewCompetitionForm } from "@/components/events/new-competition-form";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

export default async function NewEventPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");
  if (user.role === "lectura") redirect("/events");

  return (
    <PageShell>
      <Button variant="outline" size="sm" className="w-fit" asChild>
        <Link href="/events">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Campeonatos
        </Link>
      </Button>

      <PageHeader
        eyebrow="Operaciones"
        title="Nuevo campeonato"
        description="Crea un evento en borrador y configura la tarima arbitral después."
      />

      <NewCompetitionForm zones={(await dataService.getMeta(user)).zones} defaultZona={user.zona} />
    </PageShell>
  );
}
