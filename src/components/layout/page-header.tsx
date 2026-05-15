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
    <div className={cn("flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="friendly-label mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-glow-primary" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
