import { cn } from "@/lib/utils";

export type WorkflowStatus = "pendiente" | "aprobado" | "rechazado";

const statusStyles: Record<WorkflowStatus, string> = {
  pendiente: "bg-warning-muted text-warning",
  aprobado: "bg-success-muted text-success",
  rechazado: "bg-primary-muted text-brand",
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
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium capitalize",
        style,
        className,
      )}
    >
      {status}
    </span>
  );
}
