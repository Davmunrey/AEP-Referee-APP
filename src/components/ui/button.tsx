import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-base) ease-out focus-ring disabled:pointer-events-none disabled:opacity-50 active:scale-(--scale-press) [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-primary hover:bg-primary-hover",
        secondary:
          "bg-card text-foreground border border-border shadow-sm hover:bg-surface hover:border-border-strong active:bg-surface-hover",
        outline:
          "border border-border bg-card text-foreground shadow-sm hover:bg-surface hover:border-border-strong active:bg-surface-hover",
        ghost:
          "text-muted-foreground hover:bg-surface hover:text-foreground active:bg-surface-hover",
        destructive:
          "bg-destructive text-destructive-foreground shadow-primary hover:bg-primary-hover",
      },
      size: {
        default: "h-9 px-4 py-2",
        // En móvil, 36 px de alto como mínimo: 32 px es poco para el dedo.
        sm: "h-8 max-sm:h-9 rounded-lg px-3 text-ui",
        lg: "h-10 rounded-lg px-6 text-title",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
