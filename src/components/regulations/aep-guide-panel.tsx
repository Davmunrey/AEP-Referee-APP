"use client";

import { ReadingSection, ReferenceTable } from "@/components/regulations/reading-section";
import {
  AEP_COMPETITION_LEVELS,
  AEP_FEES_2026,
  AEP_GEOGRAPHIC_ZONES,
  AEP_GUIDE_META,
  AEP_GUIDE_SECTIONS,
  AEP_JUDGE_LICENSE_NOTE,
  AEP_MIN_MARKS,
} from "@/lib/aep-guide-2026";

type MarkRow = { cat: string; kg: number };

function MarksSection({
  title,
  note,
  female,
  male,
}: {
  title: string;
  note: string;
  female: readonly MarkRow[];
  male: readonly MarkRow[];
}) {
  return (
    <ReadingSection title={title} subtitle={note} wide>
      <div className="grid gap-6 sm:grid-cols-2">
        {(
          [
            ["Femenino", female],
            ["Masculino", male],
          ] as const
        ).map(([label, rows]) => (
          <div key={label}>
            <h3 className="text-sm font-semibold text-foreground">{label}</h3>
            <div className="mt-1">
              <ReferenceTable
                head={["Categoría", "Total (kg)"]}
                numericFrom={1}
                rows={rows.map((r) => [r.cat, r.kg])}
              />
            </div>
          </div>
        ))}
      </div>
    </ReadingSection>
  );
}

export function AepGuidePanel() {
  return (
    <article className="space-y-6">
      <p className="max-w-[70ch] text-[15px] leading-relaxed text-foreground-secondary">
        <strong className="font-semibold text-foreground">{AEP_GUIDE_META.title}</strong>, temporada{" "}
        {AEP_GUIDE_META.season}. Última actualización: {AEP_GUIDE_META.updatedLabel}. Referencia
        para delegados y comité de jueces en AEP Tarima; la convocatoria de cada campeonato
        prevalece en caso de discrepancia.
      </p>

      {AEP_GUIDE_SECTIONS.map((section) => (
        <ReadingSection key={section.id} id={`guia-${section.id}`} title={section.title}>
          <p>{section.body}</p>
        </ReadingSection>
      ))}

      <ReadingSection title="Cuotas temporada 2026">
        <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
          <li>Licencia ordinaria atleta: {AEP_FEES_2026.licenciaOrdinaria} €</li>
          <li>Licencia básica (jueces, técnicos…): {AEP_FEES_2026.licenciaBasica} €</li>
          <li>Inscripción AEP-1 / AEP-2 / clasificatorio: {AEP_FEES_2026.inscripcionAep123} €</li>
          <li>Inscripción AEP-3: {AEP_FEES_2026.inscripcionAep3} €</li>
          <li>Examen Juez Nacional AEP: {AEP_FEES_2026.examenJuezNacional} €</li>
          <li>Afiliación club: {AEP_FEES_2026.afiliacionClub} €</li>
        </ul>
        <p className="text-sm text-muted-foreground">{AEP_JUDGE_LICENSE_NOTE}</p>
      </ReadingSection>

      {/* Antes iban la lista y la tabla con los mismos cinco pares código/zona;
          basta con la tabla. */}
      <ReadingSection title="Zonas operativas (Excel jueces)">
        <ReferenceTable head={["Código", "Zona"]} rows={AEP_GEOGRAPHIC_ZONES.map((z) => [z.id, z.name])} />
      </ReadingSection>

      {AEP_COMPETITION_LEVELS.map((level) => (
        <ReadingSection key={level.type} title={level.title} subtitle={level.summary}>
          <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
            {level.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </ReadingSection>
      ))}

      <MarksSection
        title={AEP_MIN_MARKS.regional.label}
        note={AEP_MIN_MARKS.regional.note}
        female={AEP_MIN_MARKS.regional.female}
        male={AEP_MIN_MARKS.regional.male}
      />
      <MarksSection
        title={AEP_MIN_MARKS.open.label}
        note={AEP_MIN_MARKS.open.note}
        female={AEP_MIN_MARKS.open.female}
        male={AEP_MIN_MARKS.open.male}
      />
    </article>
  );
}
