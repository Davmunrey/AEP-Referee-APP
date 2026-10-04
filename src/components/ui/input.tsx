import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-[color,background-color,border-color,box-shadow] duration-(--duration-base) ease-out",
        "placeholder:text-subtle-muted",
        "hover:border-border-strong",
        "focus-visible:border-primary-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
