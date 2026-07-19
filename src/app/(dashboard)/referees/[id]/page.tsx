import Link from "next/link";
import { notFound } from "next/navigation";
import { EventTypeBadge, LevelBadge, StatusBadge } from "@/components/aep/badges";
import { ExamsManager } from "@/components/judge/exams-manager";
import { ReportsManager } from "@/components/judge/reports-manager";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { RefereeEditForm } from "@/components/referees/referee-edit-form";
import { RefereePromotionButton } from "@/components/referees/referee-promotion-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveZoneCode, zoneUiName } from "@/lib/aep-zones";
import { displayUltimo } from "@/lib/utils";
import { canManageJudges, getSession } from "@/lib/auth/session";
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
    dataService.getCompetitionOptions(user),
  ]);
  if (!profile) notFound();

  const {
    referee,
    exams,
    reports,
    sanctions,
    activeSanction,
    competitionHistory,
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
  const canEdit = canManageJudges(user);
  const canSanction = canManageSanctions(user, referee.zona);
  const canDelete = user.role === "super_admin" || user.role === "delegado_jueces";

  const trayectoria = [
    { label: "Campeonatos", value: competitionHistory.length },
    { label: "Plazas reales", value: competitionHistory.reduce((n, c) => n + c.slotCount, 0) },
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
        <div className="px-5 py-4">
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
        <RefereeArbitrajePanel
          stats={referee.arbitrajeStats}
          byYear={referee.arbitrajeStatsByYear}
        />
      )}

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-border-muted">
          <CardTitle className="text-sm font-semibold">Historial real de campeonatos</CardTitle>
          <p className="text-xs text-subtle-muted">
            Fuente: cuadrantes y asignaciones guardadas en tarima.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {competitionHistory.length === 0 ? (
            <div className="px-5 py-6">
              <p className="text-sm font-medium text-foreground">
                Sin historial detallado de tarima.
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-subtle-muted">
                El Excel solo aporta recuento agregado por rol. Para ver en qué campeonato,
                sesión y puesto estuvo este juez, importa o aplica un cuadrante en su
                competición.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-muted">
              {competitionHistory.map((item) => (
                <Link
                  key={item.competitionId}
                  href={`/competitions/${item.competitionId}`}
                  className="grid gap-3 px-5 py-3 transition-colors hover:bg-surface-hover md:grid-cols-[minmax(0,1fr)_120px_120px]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <EventTypeBadge tipo={item.tipo} />
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.competitionName}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-subtle-muted">
                      {item.sede}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.positions.map((position) => (
                        <span
                          key={position.slotKey}
                          className="rounded-full border border-border-muted bg-surface px-2 py-1 text-[11px] font-medium text-muted-foreground"
                        >
                          {position.session} · {position.roleLabel} · Hueco {position.slotIndex + 1}
                          {position.flags?.compartido ? " · *" : ""}
                          {position.flags?.intercambio ? " · ↑↓" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground md:text-right">
                    {item.fecha}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground md:text-right">
                    {item.slotCount} plaza{item.slotCount === 1 ? "" : "s"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              <p className="friendly-label mb-1">Plazas importadas (histórico)</p>
              <p className="font-mono text-sm text-foreground">{referee.eventos}</p>
            </div>
            <div>
              <p className="friendly-label mb-1">Última competición</p>
              <p className="text-sm text-foreground">{displayUltimo(referee.ultimo)}</p>
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
        <div className="grid grid-cols-2 content-start gap-4 lg:col-span-2">
          {trayectoria.map((t) => (
            <Card key={t.label}>
              <CardContent className="px-4 py-3.5">
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
        competitions={competitions}
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
