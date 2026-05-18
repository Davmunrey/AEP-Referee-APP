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
import { resolveZoneCode, zoneUiName } from "@/lib/aep-zones";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { ArrowLeft, Pencil } from "lucide-react";
import { redirect } from "next/navigation";
import { RefereeArbitrajePanel } from "@/components/referees/referee-arbitraje-panel";
import { RefereeSanctionsPanel } from "@/components/referees/referee-sanctions-panel";
import { canManageSanctions } from "@/lib/permissions";
import { DeleteRefereeButton } from "./delete-referee-button";

interface RefereePageProps {
  params: Promise<{ id: string }>;
}

export default async function RefereeDetailPage({ params }: RefereePageProps) {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const [profile, meta, competitions] = await Promise.all([
    dataService.getJudgeProfile(id),
    dataService.getMeta(user),
    dataService.getCompetitions(user),
  ]);
  if (!profile) notFound();

  const {
    referee,
    exams,
    reports,
    sanctions,
    activeSanction,
    examsPassed,
    examsTotal,
    avgScore,
  } = profile;
  if (user.role === "delegado_zona" && user.zona) {
    const userZone = resolveZoneCode(user.zona) ?? user.zona;
    const refZone = resolveZoneCode(referee.zona) ?? referee.zona;
    if (refZone !== userZone) notFound();
  }
  const zoneName = zoneUiName(referee.zona);
  const canEdit = user.role !== "solo_ver";
  const canSanction = canManageSanctions(user, referee.zona);
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
        description={`Ficha de jueces · ${zoneName}`}
      />

      {/* Hero card */}
      <Card className="overflow-hidden p-0">
        <div className="px-6 py-5">
          <div className="flex flex-wrap items-start gap-4">
            {/* Avatar */}
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/20 bg-primary/10 text-lg font-bold text-primary">
              {referee.iniciales}
            </span>

            {/* Identity */}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle-muted">
                {zoneName}
              </p>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-foreground">
                {referee.nombre}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <LevelBadge level={referee.nivel} />
                <StatusBadge status={referee.estado} />
                {referee.disp && (
                  <span className="rounded-full bg-success-muted px-2 py-0.5 text-[11px] font-medium text-success">
                    Disponible
                  </span>
                )}
                {referee.licencia && (
                  <span className="font-mono text-[11px] text-subtle-muted">
                    Lic. {referee.licencia}
                  </span>
                )}
              </div>
            </div>

            {/* Quick actions */}
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <RefereePromotionButton
                  refereeId={referee.id}
                  currentLevel={referee.nivel}
                />
                <Button variant="outline" size="sm" asChild>
                  <a href="#edit-form">
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Editar
                  </a>
                </Button>
                {canDelete && (
                  <DeleteRefereeButton
                    refereeId={referee.id}
                    refereeName={referee.nombre}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {referee.arbitrajeStats && referee.arbitrajeStats.total > 0 && (
        <RefereeArbitrajePanel stats={referee.arbitrajeStats} />
      )}

      {(canSanction || sanctions.length > 0 || activeSanction) && (
        <RefereeSanctionsPanel
          refereeId={referee.id}
          zonaName={zoneName}
          sanctions={sanctions}
          activeSanction={activeSanction}
          canManage={canSanction}
          zones={meta.zones}
        />
      )}

      {/* Data + Trajectory two-column layout */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Data fields — 3/5 */}
        <Card className="glass-panel-soft lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Datos del juez</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="friendly-label mb-1">Zona</p>
              <p className="text-sm text-foreground">{zoneName}</p>
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
              <p className="friendly-label mb-1">Competiciones 2026</p>
              <p className="font-mono text-sm text-foreground">{referee.eventos}</p>
            </div>
            <div>
              <p className="friendly-label mb-1">Última competición</p>
              <p className="text-sm text-foreground">{referee.ultimo}</p>
            </div>
            <div>
              <p className="friendly-label mb-1">Disponibilidad</p>
              <p className="text-sm text-foreground">
                {referee.disp ? "Disponible" : "No disponible"}
              </p>
            </div>
            {referee.localidad && (
              <div>
                <p className="friendly-label mb-1">Localidad</p>
                <p className="text-sm text-foreground">{referee.localidad}</p>
              </div>
            )}
            {referee.telefono && (
              <div>
                <p className="friendly-label mb-1">Teléfono</p>
                <p className="text-sm text-foreground">{referee.telefono}</p>
              </div>
            )}
            {referee.email && (
              <div>
                <p className="friendly-label mb-1">Email</p>
                <a href={`mailto:${referee.email}`} className="text-sm text-primary hover:underline">
                  {referee.email}
                </a>
              </div>
            )}
            {referee.genero && (
              <div>
                <p className="friendly-label mb-1">Género</p>
                <p className="text-sm text-foreground">{referee.genero}</p>
              </div>
            )}
            {referee.antiguedad && (
              <div>
                <p className="friendly-label mb-1">Antigüedad</p>
                <p className="text-sm text-foreground">{referee.antiguedad}</p>
              </div>
            )}
            {referee.excelId != null && (
              <div>
                <p className="friendly-label mb-1">ID registro</p>
                <p className="font-mono text-sm text-foreground">{referee.excelId}</p>
              </div>
            )}
            {referee.notas && (
              <div className="sm:col-span-2">
                <p className="friendly-label mb-1">Notas</p>
                <p className="text-sm text-foreground-secondary">{referee.notas}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trajectory stats — 2/5 */}
        <div className="grid grid-cols-2 content-start gap-3 lg:col-span-2">
          {trayectoria.map((t) => (
            <Card key={t.label}>
              <CardContent className="px-5 py-4">
                <p className="friendly-label mb-1">{t.label}</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {t.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <ExamsManager
        exams={exams}
        referees={[{ id: referee.id, nombre: referee.nombre, nivel: referee.nivel }]}
        lockedRefereeId={referee.id}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <ReportsManager
        reports={reports}
        referees={[{ id: referee.id, nombre: referee.nombre }]}
        competitions={competitions.map((c) => ({ id: c.id, nombre: c.nombre }))}
        lockedRefereeId={referee.id}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      {canEdit && (
        <div id="edit-form">
          <RefereeEditForm referee={referee} zones={meta.zones} levels={meta.levels} />
        </div>
      )}
    </PageShell>
  );
}
