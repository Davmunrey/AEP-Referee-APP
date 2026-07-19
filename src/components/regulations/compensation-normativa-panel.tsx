"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COMPENSATION_NORMATIVA_FOOTNOTES,
  COMPENSATION_NORMATIVA_META,
  COMPENSATION_NORMATIVA_SECTIONS,
  COMPENSATION_RATE_TABLE,
} from "@/lib/judge-compensation/normativa-content";

export function CompensationNormativaPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary-border bg-primary-muted px-4 py-3 text-sm leading-relaxed text-foreground-secondary">
        <p>
          <strong className="text-foreground">{COMPENSATION_NORMATIVA_META.title}</strong> — baremo
          vigente desde {COMPENSATION_NORMATIVA_META.revisionLabel}. La aplicación calcula
          automáticamente según la tarima y los datos introducidos en{" "}
          <Link href="/compensation" className="text-primary hover:underline">
            Compensación
          </Link>
          .
        </p>
        <p className="mt-2">
          <a
            href={COMPENSATION_NORMATIVA_META.sourcePdf}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Descargar criterios oficiales AEP (PDF)
          </a>
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Baremo por tipo de campeonato</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border-muted bg-surface/80 text-[11px] uppercase tracking-wide text-subtle-muted">
              <tr>
                <th className="px-4 py-2">Concepto</th>
                <th className="px-4 py-2">AEP-3</th>
                <th className="px-4 py-2">AEP-2</th>
                <th className="px-4 py-2">AEP-1</th>
                <th className="px-4 py-2">EPF/IPF</th>
              </tr>
            </thead>
            <tbody>
              {COMPENSATION_RATE_TABLE.map((row) => (
                <tr key={row.concept} className="border-b border-border-muted/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{row.concept}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{row.aep3}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{row.aep2}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{row.aep1}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{row.intl}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="space-y-1 border-t border-border-muted px-4 py-3 text-xs text-muted-foreground">
            {COMPENSATION_NORMATIVA_FOOTNOTES.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {COMPENSATION_NORMATIVA_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-foreground-secondary">
            {section.body}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
