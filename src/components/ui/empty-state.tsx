import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/30 px-8 py-16 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border-muted bg-muted shadow-sm">
          <Icon className="h-6 w-6 text-subtle-muted" />
        </span>
      ) : null}
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
