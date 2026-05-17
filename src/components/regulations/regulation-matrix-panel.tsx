"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { RefereeLevel, RegulationRule } from "@/lib/types";

const LEVEL_RANK: Record<RefereeLevel, number> = {
  Regional: 1,
  Nacional: 2,
  "IPF Cat. 2": 3,
  "IPF Cat. 1": 4,
};

interface RegulationMatrixPanelProps {
  rules: RegulationRule[];
}

export function RegulationMatrixPanel({ rules }: RegulationMatrixPanelProps) {
  const sorted = [...rules].sort((a, b) => {
    const ra = LEVEL_RANK[a.minLevel] ?? 0;
    const rb = LEVEL_RANK[b.minLevel] ?? 0;
    if (ra !== rb) return rb - ra;
    return a.rol.localeCompare(b.rol);
  });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-muted bg-surface/80 text-left text-xs text-subtle-muted">
                <th className="px-4 py-2.5 font-medium">Rol</th>
                <th className="px-4 py-2.5 font-medium">Nivel mínimo</th>
                <th className="px-4 py-2.5 font-medium">Campeonatos</th>
                <th className="px-4 py-2.5 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((rule) => (
                <tr key={rule.id} className="border-b border-border-muted/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{rule.rol}</td>
                  <td className="px-4 py-2.5 text-foreground-secondary">{rule.minLevel}</td>
                  <td className="px-4 py-2.5 text-foreground-secondary">
                    {rule.eventTypes.join(", ")}
                  </td>
                  <td className="px-4 py-2.5 text-xs leading-relaxed text-subtle-muted">
                    {rule.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
