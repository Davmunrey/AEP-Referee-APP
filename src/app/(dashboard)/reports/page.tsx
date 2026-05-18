import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { ReportsManager } from "@/components/judge/reports-manager";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { AlertTriangle, FileText, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default async function ReportsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const [reports, referees, competitions] = await Promise.all([
    dataService.getReports(undefined, user),
    dataService.getReferees({ user }),
    dataService.getCompetitions(user),
  ]);

  const incidencias = reports.filter((r) => r.tipo === "Incidencia").length;
  const evaluaciones = reports.filter((r) => r.tipo === "Evaluación").length;
  const jueces = new Set(reports.map((r) => r.refereeId).filter(Boolean)).size;
  const competiciones = reports.filter((r) => r.subjectType === "competicion").length;

  const stats: {
    label: string;
    value: string | number;
    tone: string;
    iconBg: string;
    Icon: LucideIcon;
  }[] = [
    {
      label: "Informes totales",
      value: reports.length,
      tone: "text-foreground-secondary",
      iconBg: "bg-muted",
      Icon: FileText,
    },
    {
      label: "Incidencias",
      value: incidencias,
      tone: "text-destructive",
      iconBg: "bg-destructive-muted",
      Icon: AlertTriangle,
    },
    {
      label: "Evaluaciones",
      value: evaluaciones,
      tone: "text-warning",
      iconBg: "bg-warning-muted",
      Icon: Star,
    },
    {
      label: "Jueces con informe",
      value: jueces,
      tone: "text-primary",
      iconBg: "bg-primary-muted",
      Icon: Users,
    },
    {
      label: "Informes de competición",
      value: competiciones,
      tone: "text-info-soft",
      iconBg: "bg-info-muted",
      Icon: FileText,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestión de jueces"
        title="Informes de zona"
        description="Informes de jueces y competiciones. Delegado de zona ve su zona; nacional y superadmin ven todo."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 px-4 py-3.5">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  s.iconBg,
                )}
              >
                <s.Icon className={cn("h-4 w-4", s.tone)} aria-hidden="true" />
              </div>
              <div>
                <p className={cn("text-2xl font-bold leading-none tracking-tight", s.tone)}>
                  {s.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ReportsManager
        reports={reports}
        referees={referees.map((r) => ({ id: r.id, nombre: r.nombre }))}
        competitions={competitions.map((c) => ({ id: c.id, nombre: c.nombre }))}
        canEdit={user.role !== "solo_ver"}
        canDelete={user.role === "super_admin" || user.role === "delegado_jueces"}
      />
    </PageShell>
  );
}
