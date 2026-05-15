import Link from "next/link";
import { notFound } from "next/navigation";
import { LevelBadge, StatusBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { RefereeEditForm } from "@/components/referees/referee-edit-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { getLevels, getZones } from "@/server/store";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

interface RefereePageProps {
  params: Promise<{ id: string }>;
}

export default async function RefereeDetailPage({ params }: RefereePageProps) {
  const user = await getSession();
  if (!user) redirect("/login");

  const { id } = await params;
  const referee = dataService.getReferee(id);
  if (!referee) notFound();

  const zoneName = getZones().find((z) => z.code === referee.zona)?.name ?? referee.zona;

  return (
    <PageShell className="max-w-3xl">
      <Button variant="outline" size="sm" className="w-fit" asChild>
        <Link href="/referees">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Directorio
        </Link>
      </Button>

      <PageHeader eyebrow="Operaciones" title={referee.nombre} description={`Ficha arbitral · ${zoneName}`} />

      <Card className="glass-panel-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-lg font-semibold">
              {referee.iniciales}
            </span>
            Resumen
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="friendly-label mb-1">Zona</p>
            <p className="text-sm text-foreground">
              {referee.zona} · {zoneName}
            </p>
          </div>
          <div>
            <p className="friendly-label mb-1">Nivel</p>
            <LevelBadge level={referee.nivel} />
          </div>
          <div>
            <p className="friendly-label mb-1">Estado</p>
            <StatusBadge status={referee.estado} />
          </div>
          <div>
            <p className="friendly-label mb-1">Eventos 2026</p>
            <p className="font-mono text-sm text-foreground">{referee.eventos}</p>
          </div>
          <div>
            <p className="friendly-label mb-1">Último evento</p>
            <p className="text-sm text-foreground">{referee.ultimo}</p>
          </div>
          <div>
            <p className="friendly-label mb-1">Disponibilidad</p>
            <p className="text-sm text-foreground">{referee.disp ? "Disponible" : "No disponible"}</p>
          </div>
        </CardContent>
      </Card>

      {user.role !== "lectura" && (
        <RefereeEditForm referee={referee} zones={getZones()} levels={getLevels()} />
      )}
    </PageShell>
  );
}
