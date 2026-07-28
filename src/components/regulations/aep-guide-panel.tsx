"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AEP_COMPETITION_LEVELS,
  AEP_FEES_2026,
  AEP_GEOGRAPHIC_ZONES,
  AEP_GUIDE_META,
  AEP_GUIDE_SECTIONS,
  AEP_JUDGE_LICENSE_NOTE,
  AEP_MIN_MARKS,
} from "@/lib/aep-guide-2026";

function WeightTable({ rows }: { rows: readonly { cat: string; kg: number }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-muted">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border-muted bg-surface/80">
            <th className="px-2 py-1.5 text-left font-medium">Cat.</th>
            <th className="px-2 py-1.5 text-right font-medium">Total (kg)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cat} className="border-b border-border-muted/60 last:border-0">
              <td className="px-2 py-1 text-foreground-secondary">{r.cat}</td>
              <td className="px-2 py-1 text-right tabular-nums">{r.kg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryTable({
  label,
  rows,
}: {
  label: string;
  rows: readonly { cat: string; kg: number }[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-foreground-secondary">{label}</p>
      <WeightTable rows={rows} />
    </div>
  );
}

function MarksTable({
  title,
  note,
  female,
  male,
}: {
  title: string;
  note: string;
  female: readonly { cat: string; kg: number }[];
  male: readonly { cat: string; kg: number }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <p className="text-xs leading-relaxed text-subtle-muted">{note}</p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <CategoryTable label="Femenino" rows={female} />
        <CategoryTable label="Masculino" rows={male} />
      </CardContent>
    </Card>
  );
}

export function AepGuidePanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary-border bg-primary-muted px-4 py-3 text-sm leading-relaxed text-foreground-secondary">
        <p>
          <strong className="text-foreground">{AEP_GUIDE_META.title}</strong> — temporada{" "}
          {AEP_GUIDE_META.season}. Última actualización: {AEP_GUIDE_META.updated}. Referencia
          para delegados y comité de jueces en AEP Tarima; la convocatoria de cada campeonato
          prevalece en caso de discrepancia.
        </p>
      </div>

      {AEP_GUIDE_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-foreground-secondary">
            {section.body}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cuotas temporada 2026</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1.5 text-sm text-foreground-secondary sm:grid-cols-2">
            <li>Licencia ordinaria atleta: {AEP_FEES_2026.licenciaOrdinaria} €</li>
            <li>Licencia básica (jueces, técnicos…): {AEP_FEES_2026.licenciaBasica} €</li>
            <li>Inscripción AEP-1 / AEP-2 / clasificatorio: {AEP_FEES_2026.inscripcionAep123} €</li>
            <li>Inscripción AEP-3: {AEP_FEES_2026.inscripcionAep3} €</li>
            <li>Examen Juez Nacional AEP: {AEP_FEES_2026.examenJuezNacional} €</li>
            <li>Afiliación club: {AEP_FEES_2026.afiliacionClub} €</li>
          </ul>
          <p className="mt-3 text-xs text-subtle-muted">{AEP_JUDGE_LICENSE_NOTE}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Zonas operativas (Excel jueces)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm text-foreground-secondary">
            {AEP_GEOGRAPHIC_ZONES.map((z) => (
              <li key={z.id}>
                <span className="font-medium text-foreground">{z.name}</span>
                <span className="font-mono text-subtle-muted"> ({z.id})</span>
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto rounded-lg border border-border-muted">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-muted bg-surface/80">
                  <th className="px-2 py-1.5 text-left font-medium">Código</th>
                  <th className="px-2 py-1.5 text-left font-medium">Zona</th>
                </tr>
              </thead>
              <tbody>
                {AEP_GEOGRAPHIC_ZONES.map((z) => (
                  <tr key={z.id} className="border-b border-border-muted/60 last:border-0">
                    <td className="px-2 py-1 font-mono text-foreground">{z.id}</td>
                    <td className="px-2 py-1 text-foreground-secondary">{z.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {AEP_COMPETITION_LEVELS.map((level) => (
        <Card key={level.type}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{level.title}</CardTitle>
            <p className="text-xs text-subtle-muted">{level.summary}</p>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-4 text-sm text-foreground-secondary">
              {level.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <MarksTable
        title={AEP_MIN_MARKS.regional.label}
        note={AEP_MIN_MARKS.regional.note}
        female={AEP_MIN_MARKS.regional.female}
        male={AEP_MIN_MARKS.regional.male}
      />
      <MarksTable
        title={AEP_MIN_MARKS.open.label}
        note={AEP_MIN_MARKS.open.note}
        female={AEP_MIN_MARKS.open.female}
        male={AEP_MIN_MARKS.open.male}
      />
    </div>
  );
}
