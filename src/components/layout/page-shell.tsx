import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  /** Sin padding lateral extra (p. ej. tarima a pantalla completa). */
  flush?: boolean;
}

export function PageShell({ children, className, flush }: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto max-w-[1600px] space-y-6 pb-10",
        flush ? "px-0 py-0" : "p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { PageHeader };
