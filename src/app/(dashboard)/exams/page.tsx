import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { ExamsManager } from "@/components/judge/exams-manager";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { dataService } from "@/server/services";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { AEP_JUDGE_LICENSE_NOTE } from "@/lib/aep-guide-2026";
import { BarChart2, BookOpen, CheckCircle2, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default async function ExamsPage() {
  const user = await getSession();
  if (!user) redirect("/sign-in");

  const [exams, referees] = await Promise.all([
    dataService.getExams(undefined, user),
    dataService.getReferees({ user }),
  ]);

  const aprobados = exams.filter((e) => e.resultado === "Aprobado").length;
  const pendientes = exams.filter((e) => e.resultado === "Pendiente").length;
  const suspensos = exams.filter((e) => e.resultado === "Suspenso").length;
  const resueltos = aprobados + suspensos;
  const tasa = resueltos > 0 ? Math.round((aprobados / resueltos) * 100) : 0;

  const stats: {
    label: string;
    value: string | number;
    tone: string;
    iconBg: string;
    Icon: LucideIcon;
  }[] = [
    {
      label: "Exámenes totales",
      value: exams.length,
      tone: "text-foreground-secondary",
      iconBg: "bg-muted",
      Icon: BookOpen,
    },
    {
      label: "Aprobados",
      value: aprobados,
      tone: "text-success",
      iconBg: "bg-success-muted",
      Icon: CheckCircle2,
    },
    {
      label: "Pendientes",
      value: pendientes,
      tone: "text-warning",
      iconBg: "bg-warning-muted",
      Icon: Clock,
    },
    {
      label: "Tasa de aprobación",
      value: `${tasa}%`,
      tone: "text-primary",
      iconBg: "bg-primary-muted",
      Icon: BarChart2,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestión de jueces"
        title="Exámenes de jueces"
        description="Altas de nuevos jueces, ascensos a categoría IPF y recertificaciones"
      />
      <p className="-mt-2 text-sm text-subtle-muted">{AEP_JUDGE_LICENSE_NOTE}</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      <ExamsManager
        exams={exams}
        referees={referees.map((r) => ({ id: r.id, nombre: r.nombre, nivel: r.nivel }))}
        canEdit={user.role !== "solo_ver"}
        canDelete={user.role === "super_admin" || user.role === "delegado_jueces"}
      />
    </PageShell>
  );
}
