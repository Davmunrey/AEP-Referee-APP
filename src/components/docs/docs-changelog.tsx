import { Fragment } from "react";
import { getChangelogVersions, type ChangelogVersion } from "@/lib/changelog";

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
    <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
      {groups.map((group, i) =>
        group.type === "ul" ? (
          <ul key={i} className="space-y-1.5 pl-4">
            {group.items.map((item, j) => (
              <li key={j} className="list-disc marker:text-primary/60">
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
    <div className="space-y-4">
      {/* Última versión: siempre visible */}
      <div className="rounded-xl border border-primary-border bg-primary-muted/50 p-4">
        <h3 className="text-sm font-semibold text-foreground">{renderInline(latest!.heading)}</h3>
        <div className="mt-2.5">
          <VersionBody version={latest!} />
        </div>
      </div>

      {/* Anteriores: plegadas para no hacer la página kilométrica */}
      {previous.map((version) => (
        <details
          key={version.heading}
          className="group rounded-xl border border-border bg-card p-4"
        >
          <summary className="cursor-pointer list-none rounded-sm text-sm font-semibold text-foreground focus-ring [&::-webkit-details-marker]:hidden">
            <span className="mr-1.5 inline-block text-subtle-muted transition-transform group-open:rotate-90">
              ›
            </span>
            {renderInline(version.heading)}
          </summary>
          <div className="mt-2.5">
            <VersionBody version={version} />
          </div>
        </details>
      ))}
    </div>
  );
}
