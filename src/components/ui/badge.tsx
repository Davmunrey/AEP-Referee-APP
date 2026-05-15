import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        regional: "border-info-border bg-info-muted text-info",
        nacional: "border-primary-border bg-primary-muted text-primary",
        ipf1: "border-primary-border bg-primary-muted text-primary",
        ipf2: "border-warning-border bg-warning-muted text-warning",
        success: "border-success-border bg-success-muted text-success",
        warning: "border-warning-border bg-warning-muted text-warning",
        danger: "border-destructive-border bg-destructive-muted text-destructive",
        muted: "border-border-strong bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
