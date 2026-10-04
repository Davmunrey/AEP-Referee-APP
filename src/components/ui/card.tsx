import * as React from "react";
import { cn } from "@/lib/utils";
import { tokens } from "@/lib/design-tokens";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "surface-card rounded-xl text-card-foreground transition-[color,background-color,border-color,box-shadow] duration-(--duration-base) ease-out",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1 p-4 pb-3", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

/**
 * Título de una tarjeta. Es `h2` por defecto: las tarjetas son las secciones
 * de cada página, justo debajo del `h1`. Antes era `h3` y todas las pantallas
 * saltaban de h1 a h3, que es como un lector de pantalla recorre la página.
 * Una tarjeta dentro de una sección que ya tiene su `h2` pasa `as="h3"`.
 */
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" }
>(({ className, as: Heading = "h2", ...props }, ref) => (
  <Heading
    ref={ref}
    className={cn("text-title font-semibold leading-snug tracking-snug", tokens.text.primary, className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm leading-relaxed", tokens.text.muted, className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
