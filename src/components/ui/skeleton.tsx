import { cn } from "@/lib/utils";

/** Bloque de carga con pulso. Úsalo para imitar el layout mientras llegan los datos. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted/60", className)} {...props} />;
}
