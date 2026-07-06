import { cn } from "@/lib/utils";

/** Bloque de carga con barrido (shimmer). Imita el layout mientras llegan los datos. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton-shimmer rounded-md", className)} {...props} />;
}
