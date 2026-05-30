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
        "mx-auto max-w-[1360px] space-y-3 pb-5 xl:space-y-4 xl:pb-6 2xl:space-y-5 2xl:pb-8",
        flush ? "px-0 py-0" : "px-4 py-4 sm:px-5 sm:py-5 lg:px-6 xl:py-5 2xl:py-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { PageHeader };
