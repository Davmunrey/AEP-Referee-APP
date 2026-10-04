import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-transparent font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        regional: "bg-info-muted text-info",
        nacional: "bg-primary-muted text-primary",
        ipf1: "bg-primary-muted text-primary",
        ipf2: "bg-warning-muted text-warning",
        success: "bg-success-muted text-success",
        warning: "bg-warning-muted text-warning",
        danger: "bg-destructive-muted text-destructive",
        muted: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
      },
      size: {
        default: "px-1.5 py-0.5 text-xs",
        // 11 px es el suelo de lectura; antes 10 px.
        sm: "px-1.5 py-px text-2xs leading-tight",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
