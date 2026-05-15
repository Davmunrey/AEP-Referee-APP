import { LevelBadge } from "@/components/aep/badges";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderRow,
  DataTableHeadCell,
  DataTableRow,
} from "@/components/ui/data-table";
import type { RegulationRule } from "@/lib/types";
import { BookOpen } from "lucide-react";

export function RegulationsView({ rules }: { rules: RegulationRule[] }) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestión"
        title="Normativa IPF / AEP"
        description="Requisitos mínimos de nivel por rol y tipo de campeonato"
      />

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border-muted pb-4">
          <BookOpen className="h-4 w-4 text-primary" />
          <CardTitle>Matriz rol → nivel mínimo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable>
            <DataTableHead>
              <DataTableHeaderRow>
                <DataTableHeadCell>Rol</DataTableHeadCell>
                <DataTableHeadCell>Nivel mínimo</DataTableHeadCell>
                <DataTableHeadCell>Tipos evento</DataTableHeadCell>
                <DataTableHeadCell>Notas</DataTableHeadCell>
              </DataTableHeaderRow>
            </DataTableHead>
            <DataTableBody>
              {rules.map((r) => (
                <DataTableRow key={r.id}>
                  <DataTableCell className="font-medium text-foreground">{r.rol}</DataTableCell>
                  <DataTableCell>
                    <LevelBadge level={r.minLevel} />
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs text-muted-foreground">
                    {r.eventTypes.join(", ")}
                  </DataTableCell>
                  <DataTableCell className="text-subtle-muted">{r.note}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </CardContent>
      </Card>

      <p className="rounded-xl border border-border-muted bg-surface/50 px-4 py-3 text-xs leading-relaxed text-subtle-muted">
        Referencia: IPF Technical Rules · AEP Reglamento de competición 2026. Los PDF oficiales se
        integrarán cuando el backend documental esté conectado.
      </p>
    </PageShell>
  );
}
