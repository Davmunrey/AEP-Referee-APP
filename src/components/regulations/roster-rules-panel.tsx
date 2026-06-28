"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RegulationRule } from "@/lib/types";

export function RosterRulesPanel({ rules }: { rules: RegulationRule[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-muted bg-surface/50 px-4 py-3 text-sm leading-relaxed text-foreground-secondary">
        <p>
          Niveles mínimos por plaza y tipo de campeonato (AEP-1, AEP-2, AEP-3). La tarima valida
          las asignaciones según estas reglas y avisa si un juez no cumple el nivel requerido.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Requisitos por plaza en tarima</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border-muted bg-surface/80 text-[11px] uppercase tracking-wide text-subtle-muted">
              <tr>
                <th className="px-4 py-2">Plaza</th>
                <th className="px-4 py-2">Nivel mínimo</th>
                <th className="px-4 py-2">Campeonatos</th>
                <th className="px-4 py-2">Notas</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border-muted/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{rule.rol}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{rule.minLevel}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground-secondary">
                    {rule.eventTypes.join(", ")}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{rule.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
