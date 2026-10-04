import Link from "next/link";
import { notFound } from "next/navigation";
import { EventTypeBadge, LevelBadge, StatusBadge } from "@/components/aep/badges";
import { ExamsManager } from "@/components/judge/exams-manager";
import { ReportsManager } from "@/components/judge/reports-manager";
import { PageShell } from "@/components/layout/page-shell";
import { RefereeEditForm } from "@/components/referees/referee-edit-form";
import { RefereePromotionButton } from "@/components/referees/referee-promotion-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveZoneCode, zoneUiName } from "@/lib/aep-zones";
import { displayUltimo, formatDateRange } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MetricStrip, MetricTile } from "@/components/ui/metric-tile";
import { contar } from "@/lib/plural";
import { canManageJudges, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { stripRefereePII } from "@/lib/referee-pii";
import { dataService } from "@/server/services";
import { ArrowLeft, Pencil } from "lucide-react";
import { RefereeArbitrajePanel } from "@/components/referees/referee-arbitraje-panel";
import { RefereeSanctionsPanel } from "@/components/referees/referee-sanctions-panel";
import { canManageSanctions } from "@/lib/permissions";
import { DeleteRefereeButton } from "./delete-referee-button";
import { RefereePortalAccess } from "@/components/referees/referee-portal-access";
import { getJudgeAccessStatuses } from "@/server/services/judge-accounts";

interface RefereePageProps {
  params: Promise<{ id: string }>;
}

export default async function RefereeDetailPage({ params }: RefereePageProps) {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const { id } = await params;
  const [profile, meta, competitions] = await Promise.all([
    dataService.getJudgeProfile(id),
    dataService.getMeta(user),
    dataService.getCompetitionOptions(user),
  ]);
  if (!profile) notFound();

  const {
    referee: rawReferee,
    exams,
    reports,
    sanctions,
    activeSanction,
    competitionHistory,
    examsPassed,
    examsTotal,
    avgScore,
  } = profile;
  // La ficha pintaba teléfono, email y notas: la misma PII que la ruta API
  // recorta para `solo_ver`.
  const referee = stripRefereePII(rawReferee, user);
  // Fail-closed, igual que la ruta API equivalente: sin zona en el perfil el
  // `&& user.zona` se saltaba la comprobación entera y la ficha completa de
  // cualquier juez —exámenes, informes y sanciones incluidos— se pintaba
  // entera en el servidor.
  if (user.role === "delegado_zona") {
    if (!user.zona) notFound();
    const userZone = resolveZoneCode(user.zona) ?? user.zona;
    const refZone = resolveZoneCode(referee.zona) ?? referee.zona;
    if (refZone !== userZone) notFound();
  }
  const zoneName = zoneUiName(referee.zona);
  const canEdit = canManageJudges(user);
  const portalStatus = canEdit ? (await getJudgeAccessStatuses([rawReferee]))[rawReferee.id] : undefined;
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

      {/* Hero card */}
      <Card className="overflow-hidden p-0">
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-start gap-4">
            {/* Avatar neutro, como en el directorio: el rojo de la marca se
                reserva para la acción principal y el estado activo, no para
                decorar la inicial. */}
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-lg font-semibold text-foreground-secondary">
              {referee.iniciales}
            </span>

            {/* Identity */}
            <div className="min-w-0 flex-1">
              {/* La tarjeta ES la cabecera: antes un PageHeader encima repetía
                  nombre y zona. Este es el h1 de la página. La zona va en la
                  línea de datos, no como rótulo sobre el nombre. */}
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {referee.nombre}
              </h1>
              <p className="mt-0.5 text-ui text-muted-foreground">
                {zoneName}
                {referee.licencia ? <span className="tabular-nums"> · Lic. {referee.licencia}</span> : null}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <LevelBadge level={referee.nivel} />
                <StatusBadge status={referee.estado} />
                {referee.disp ? (
                  <Badge variant="success">Disponible</Badge>
                ) : (
                  // Importa verlo: un juez «no disponible» no aparece al montar tarimas.
                  <Badge variant="warning" title="No aparece en el panel de jueces al montar tarimas">
                    No disponible
                  </Badge>
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
                <Button variant="outline" size="sm" className="max-sm:h-9" asChild>
                  <a href="#edit-form">
                    <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
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

      {/* Cifras de trayectoria en la franja común (MetricTile), justo bajo la
          cabecera: antes eran seis tarjetitas sueltas en una rejilla de 2×3 al
          lado de los datos, al final de la ficha. */}
      <MetricStrip columns={3} label="Trayectoria">
        {trayectoria.map((t) => (
          <MetricTile key={t.label} label={t.label} value={t.value} />
        ))}
      </MetricStrip>

      {portalStatus && (
        <RefereePortalAccess refereeId={rawReferee.id} status={portalStatus} hasEmail={Boolean(rawReferee.email)} />
      )}

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
                  className="grid gap-2 px-5 py-3 transition-colors hover:bg-surface-hover md:grid-cols-[minmax(0,1fr)_150px_80px] md:gap-3"
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
                    {/* Un puesto por chip: primero el puesto (lo que se busca
                        al leer), luego sesión y hueco en tono secundario. Las
                        marcas del acta (* y ↑↓) van en palabras: fuera del
                        acta nadie sabe leerlas. */}
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {item.positions.map((position) => (
                        <li
                          key={position.slotKey}
                          className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-inset ring-border-muted"
                        >
                          <span className="font-medium text-foreground-secondary">{position.roleLabel}</span>
                          {" · "}
                          {position.session} · hueco {position.slotIndex + 1}
                          {position.flags?.compartido ? " · comparte sesión" : ""}
                          {position.flags?.intercambio ? " · intercambio de pesaje" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* En móvil fecha y plazas comparten línea; en escritorio,
                      columnas alineadas a la derecha. */}
                  <p className="text-xs tabular-nums text-muted-foreground md:contents">
                    <span className="md:text-right">{formatDateRange(item.fecha, item.fechaFin || item.fecha)}</span>
                    <span className="md:hidden"> · </span>
                    <span className="md:text-right">{contar(item.slotCount, "plaza", "plazas")}</span>
                  </p>
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


      <Card className="glass-panel-soft">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Datos del juez</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <p className="text-sm text-foreground">{referee.eventos}</p>
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
              <p className="text-sm text-foreground">{referee.excelId}</p>
            </div>
          )}
          {referee.notas && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="friendly-label mb-1">Notas</p>
              <p className="text-sm text-foreground-secondary">{referee.notas}</p>
            </div>
          )}
        </CardContent>
      </Card>

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
