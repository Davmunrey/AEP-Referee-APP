import { Fragment } from "react";
import { getChangelogVersions, type ChangelogVersion } from "@/lib/changelog";
import { formatDate, formatDateRange } from "@/lib/utils";

/**
 * Sección «Novedades» de /docs: renderiza CHANGELOG.md (fuente única de
 * verdad) con el estilo de la página. Server component puro, sin cliente.
 */

const INLINE_RE = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/** Formato inline del changelog: **negrita**, _cursiva_, `código` y [enlaces](…). */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(INLINE_RE);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em] text-foreground-secondary">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      return (
        <a
          key={i}
          href={link[2]}
          className="rounded-sm text-primary underline-offset-2 hover:underline focus-ring"
          target={link[2]!.startsWith("http") ? "_blank" : undefined}
          rel={link[2]!.startsWith("http") ? "noreferrer" : undefined}
        >
          {link[1]}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function VersionBody({ version }: { version: ChangelogVersion }) {
  // Agrupa viñetas consecutivas en una sola lista para un marcado correcto.
  const groups: { type: "p" | "ul"; items: string[] }[] = [];
  for (const block of version.blocks) {
    const last = groups[groups.length - 1];
    if (block.type === "li") {
      if (last?.type === "ul") last.items.push(block.text);
      else groups.push({ type: "ul", items: [block.text] });
    } else {
      groups.push({ type: "p", items: [block.text] });
    }
  }
  return (
    <div className="space-y-2.5 text-title leading-relaxed text-foreground-secondary">
      {groups.map((group, i) =>
        group.type === "ul" ? (
          <ul key={i} className="space-y-1.5 pl-5">
            {group.items.map((item, j) => (
              <li key={j} className="list-disc pl-1 marker:text-muted-foreground">
                {renderInline(item)}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{renderInline(group.items[0]!)}</p>
        ),
      )}
    </div>
  );
}

// Fechas del CHANGELOG (ISO, a veces solo año-mes o año) al formato del resto
// de la interfaz: «4 oct 2026», nunca «2026-10-04».
const ISO_RANGE_RE = /(\d{4}-\d{2}-\d{2}) → (\d{4}-\d{2}-\d{2})/g;
const ISO_DAY_RE = /\b(\d{4}-\d{2}-\d{2})\b/g;
const ISO_MONTH_RE = /\b(\d{4})-(\d{2})\b/g;

function humanizeDates(text: string): string {
  return text
    .replace(ISO_RANGE_RE, (_, a: string, b: string) => formatDateRange(a, b))
    .replace(ISO_DAY_RE, (_, d: string) => formatDate(d))
    .replace(ISO_MONTH_RE, (_, y: string, m: string) =>
      new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
    );
}

interface ParsedHeading {
  title: string;
  codename: string | null;
  meta: string | null;
}

/**
 * La cabecera del CHANGELOG lleva un emoji delante, el título en negrita, el
 * nombre en clave en cursiva y la fecha entre paréntesis. En la página el
 * emoji sobra (no es un icono que aporte nada a quien lee) y el resto se
 * compone con su propia jerarquía en vez de mezclar negritas y cursivas.
 * El fichero no se toca: es la fuente que se lee también en GitHub.
 */
function parseHeading(heading: string): ParsedHeading {
  // Todo lo anterior a la primera letra, dígito, asterisco o guion bajo es
  // decoración (emoji, selectores de variación, espacios).
  const clean = heading.replace(/^[^\p{L}\p{N}*_]+/u, "").trim();
  const title = /\*\*([^*]+)\*\*/.exec(clean)?.[1]?.trim();
  if (!title) return { title: clean, codename: null, meta: null };
  const codename = /_([^_]+)_/.exec(clean)?.[1]?.trim() ?? null;
  const metaRaw = /\(([^)]+)\)\s*$/.exec(clean)?.[1]?.trim() ?? null;
  return { title, codename, meta: metaRaw ? humanizeDates(metaRaw) : null };
}

function VersionHeading({ heading, current }: { heading: string; current?: boolean }) {
  const { title, codename, meta } = parseHeading(heading);
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-semibold text-foreground">{title}</span>
        {codename && <span className="text-foreground-secondary">{codename}</span>}
        {current && (
          <span className="rounded-full border border-border px-2 py-px text-2xs font-medium text-muted-foreground">
            actual
          </span>
        )}
      </span>
      {meta && <span className="text-sm font-normal text-muted-foreground">{meta}</span>}
    </span>
  );
}

export function DocsChangelog() {
  const versions = getChangelogVersions();
  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        El historial de versiones no está disponible en este despliegue.
      </p>
    );
  }
  const [latest, ...previous] = versions;

  return (
    <div className="border-t border-border-muted">
      {/* Última versión: siempre visible, marcada solo con «actual». */}
      <article className="border-b border-border-muted py-5">
        <h3 className="text-base">
          <VersionHeading heading={latest!.heading} current />
        </h3>
        <div className="mt-3">
          <VersionBody version={latest!} />
        </div>
      </article>

      {/* Anteriores: plegadas para no hacer la página kilométrica */}
      {previous.map((version) => (
        <details key={version.heading} className="group border-b border-border-muted">
          <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 rounded-sm py-3 text-base focus-ring [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="mt-px w-3 shrink-0 text-muted-foreground transition-transform group-open:rotate-90">
              ›
            </span>
            <VersionHeading heading={version.heading} />
          </summary>
          <div className="pb-5 pl-5">
            <VersionBody version={version} />
          </div>
        </details>
      ))}
    </div>
  );
}
