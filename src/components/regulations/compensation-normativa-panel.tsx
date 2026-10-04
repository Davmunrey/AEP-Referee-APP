"use client";

import Link from "next/link";
import { ReadingSection, ReferenceTable } from "@/components/regulations/reading-section";
import {
  COMPENSATION_NORMATIVA_FOOTNOTES,
  COMPENSATION_NORMATIVA_META,
  COMPENSATION_NORMATIVA_SECTIONS,
  COMPENSATION_RATE_TABLE,
} from "@/lib/judge-compensation/normativa-content";

const linkClass = "rounded-sm text-primary underline underline-offset-2 hover:text-primary-hover focus-ring";

export function CompensationNormativaPanel() {
  return (
    <article className="max-w-3xl space-y-6">
      <div className="max-w-[70ch] space-y-2 text-[15px] leading-relaxed text-foreground-secondary">
        <p>
          <strong className="font-semibold text-foreground">{COMPENSATION_NORMATIVA_META.title}</strong>:
          baremo vigente desde {COMPENSATION_NORMATIVA_META.revisionLabel}. La aplicación calcula
          automáticamente según la tarima y los datos introducidos en{" "}
          <Link href="/compensation" className={linkClass}>
            Compensación
          </Link>
          .
        </p>
        <p>
          <a
            href={COMPENSATION_NORMATIVA_META.sourcePdf}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Descargar criterios oficiales AEP (PDF)
          </a>
        </p>
      </div>

      <ReadingSection title="Baremo por tipo de campeonato" wide>
        <ReferenceTable
          head={["Concepto", "AEP-3", "AEP-2", "AEP-1", "EPF/IPF"]}
          minWidth="min-w-[560px]"
          rows={COMPENSATION_RATE_TABLE.map((row) => [row.concept, row.aep3, row.aep2, row.aep1, row.intl])}
        />
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
          {COMPENSATION_NORMATIVA_FOOTNOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </ReadingSection>

      {COMPENSATION_NORMATIVA_SECTIONS.map((section) => (
        <ReadingSection key={section.id} id={`compensacion-${section.id}`} title={section.title}>
          <p>{section.body}</p>
        </ReadingSection>
      ))}
    </article>
  );
}
