import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="friendly-label mb-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[25px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{description}</p>
        )}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
