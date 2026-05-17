import Link from "next/link";
import { notFound } from "next/navigation";
import { LevelBadge, StatusBadge } from "@/components/aep/badges";
import { ExamsManager } from "@/components/judge/exams-manager";
import { ReportsManager } from "@/components/judge/reports-manager";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { RefereeEditForm } from "@/components/referees/referee-edit-form";
import { RefereePromotionButton } from "@/components/referees/referee-promotion-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

interface RefereePageProps {
  params: Promise<{ id: string }>;
}

export default async function RefereeDetailPage({ params }: RefereePageProps) {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const [profile, meta] = await Promise.all([
    dataService.getJudgeProfile(id),
    dataService.getMeta(user),
  ]);
  if (!profile) notFound();

  const { referee, exams, reports, examsPassed, examsTotal, avgScore } = profile;
  const zoneName =
    meta.zones.find((z) => z.code === referee.zona)?.name ?? referee.zona;
  const canEdit = user.role !== "solo_ver";
  const canDelete = user.role === "super_admin" || user.role === "delegado_jueces";

  const trayectoria = [
    { label: "Exámenes", value: examsTotal },
    { label: "Aprobados", value: examsPassed },
    { label: "Nota media", value: avgScore != null ? `${avgScore}/100` : "—" },
    { label: "Informes", value: reports.length },
  ];

  return (
    <PageShell className="max-w-4xl">
      <Button variant="outline" size="sm" className="w-fit" asChild>
        <Link href="/referees">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Directorio
        </Link>
      </Button>

      <PageHeader
        eyebrow="Gestión de jueces"
        title={referee.nombre}
        description={`Ficha arbitral · ${zoneName}`}
      />

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
            <p className="text-sm text-foreground">
              {referee.disp ? "Disponible" : "No disponible"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        {trayectoria.map((t) => (
          <Card key={t.label}>
            <CardContent className="py-3.5">
              <p className="friendly-label mb-1">{t.label}</p>
              <p className="text-xl font-bold tracking-tight text-foreground">
                {t.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <RefereePromotionButton
            refereeId={referee.id}
            currentLevel={referee.nivel}
            zona={referee.zona}
          />
        </div>
      )}

      <ExamsManager
        exams={exams}
        referees={[{ id: referee.id, nombre: referee.nombre }]}
        lockedRefereeId={referee.id}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <ReportsManager
        reports={reports}
        referees={[{ id: referee.id, nombre: referee.nombre }]}
        lockedRefereeId={referee.id}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      {canEdit && (
        <RefereeEditForm referee={referee} zones={meta.zones} levels={meta.levels} />
      )}
    </PageShell>
  );
}
