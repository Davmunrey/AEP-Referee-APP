"use client";

import { cn } from "@/lib/utils";

export interface TransferStatItem {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "warning" | "muted";
}

export function TransferPreviewStats({
  items,
  className,
}: {
  items: TransferStatItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  const toneClass = (tone: TransferStatItem["tone"]) => {
    switch (tone) {
      case "success":
        return "text-success";
      case "warning":
        return "text-warning";
      case "muted":
        return "text-subtle-muted";
      default:
        return "text-foreground";
    }
  };
  return (
    <div
      className={cn(
        "mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 transfer-enter",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-border-muted bg-surface/80 px-3 py-2 shadow-sm transition-shadow duration-200 hover:shadow-card"
        >
          <p className="text-xs text-subtle-muted">{item.label}</p>
          <p className={cn("text-lg font-semibold tabular-nums", toneClass(item.tone))}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
