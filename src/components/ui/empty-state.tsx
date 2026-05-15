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
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface/40 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted">
          <Icon className="h-5 w-5 text-subtle-muted" />
        </span>
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
