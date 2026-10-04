import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { ReportsManager } from "@/components/judge/reports-manager";
import { MetricStrip, MetricTile, type MetricTone } from "@/components/ui/metric-tile";
import { canAdminJudges, canManageJudges, getSession, redirectSinAcceso } from "@/lib/auth/session";
import { dataService } from "@/server/services";

export default async function ReportsPage() {
  const user = await getSession();
  if (!user) return redirectSinAcceso();

  const [reports, referees, competitions] = await Promise.all([
    dataService.getReports(undefined, user),
    dataService.getReferees({ user }),
    dataService.getCompetitionOptions(user),
  ]);

  const incidencias = reports.filter((r) => r.tipo === "Incidencia").length;
  const evaluaciones = reports.filter((r) => r.tipo === "Evaluación").length;
  const jueces = new Set(reports.map((r) => r.refereeId).filter(Boolean)).size;
  const competiciones = reports.filter((r) => r.subjectType === "competicion").length;

  // El color solo marca lo que pide atención: las incidencias.
  const stats: { label: string; value: number; tone: MetricTone }[] = [
    { label: "Informes totales", value: reports.length, tone: "neutral" },
    { label: "Incidencias", value: incidencias, tone: incidencias > 0 ? "danger" : "neutral" },
    { label: "Evaluaciones", value: evaluaciones, tone: "neutral" },
    { label: "Jueces con informe", value: jueces, tone: "neutral" },
    { label: "Informes de competición", value: competiciones, tone: "neutral" },
  ];

  return (
    <PageShell>
      {/* El alcance va en su propia línea, a 75 caracteres como mucho: junto a
          la descripción la línea pasaba de 90 y costaba de leer. */}
      <div>
        <PageHeader title="Informes de zona" description="Informes de jueces y competiciones." />
        <p className="mt-1 max-w-prose text-pretty text-ui leading-relaxed text-muted-foreground sm:text-sm">
          Delegado de zona ve su zona; nacional y superadmin ven todo.
        </p>
      </div>
      {/* La misma pieza de cifras que Aprobaciones, Ascensos y Exámenes. */}
      <MetricStrip columns={5}>
        {/* Cinco cifras en dos columnas (móvil) dejan un hueco gris al final:
            la quinta ocupa la fila entera hasta que caben todas en una. */}
        {stats.map((s, i) => (
          <MetricTile
            key={s.label}
            label={s.label}
            value={s.value}
            tone={s.tone}
            className={i === stats.length - 1 ? "col-span-2 sm:col-span-1" : undefined}
          />
        ))}
      </MetricStrip>
      <ReportsManager
        reports={reports}
        referees={referees.map((r) => ({ id: r.id, nombre: r.nombre }))}
        competitions={competitions}
        // Los mismos permisos que exige la API: con `role !== "solo_ver"` se
        // pintaban botones de alta y edición a roles nacionales que luego
        // recibían un 403 al pulsarlos.
        canEdit={canManageJudges(user)}
        canDelete={canAdminJudges(user)}
      />
    </PageShell>
  );
}
