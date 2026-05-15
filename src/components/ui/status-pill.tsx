import { cn } from "@/lib/utils";

export type WorkflowStatus = "pendiente" | "aprobado" | "rechazado";

const statusStyles: Record<WorkflowStatus, string> = {
  pendiente: "bg-warning-muted text-warning",
  aprobado: "bg-success-muted text-success",
  rechazado: "bg-primary-muted text-primary",
};

interface StatusPillProps {
  status: WorkflowStatus | string;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const key = status as WorkflowStatus;
  const style = statusStyles[key] ?? "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide",
        style,
        className,
      )}
    >
      {status}
    </span>
  );
}
