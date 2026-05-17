"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";

export function TransferResultBanner({
  variant,
  title,
  children,
  className,
}: {
  variant: "success" | "error";
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const isOk = variant === "success";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "mb-4 flex gap-3 rounded-lg border p-3 text-sm",
        isOk
          ? "border-success-border bg-success-muted/40 text-foreground"
          : "border-destructive-border bg-destructive-muted/30 text-foreground",
        className,
      )}
    >
      {isOk ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <XCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {children ? <div className="mt-1 text-foreground-secondary">{children}</div> : null}
      </div>
    </div>
  );
}
