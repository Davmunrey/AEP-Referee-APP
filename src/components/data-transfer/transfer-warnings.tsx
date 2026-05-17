"use client";

export function TransferWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-warning-border bg-warning-muted/50 p-3">
      <p className="mb-1 text-xs font-medium text-warning">Avisos del análisis</p>
      <ul className="max-h-24 list-inside list-disc overflow-y-auto text-xs text-foreground-secondary">
        {warnings.map((w, i) => (
          <li key={`${i}-${w.slice(0, 24)}`}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
