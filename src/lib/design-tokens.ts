import type { UserRole } from "@/lib/types";

/** Clases Tailwind semánticas — referencian tokens del tema (globals.css / tokens.css). */
export const tokens = {
  text: {
    primary: "text-foreground",
    secondary: "text-foreground-secondary",
    muted: "text-muted-foreground",
    subtle: "text-subtle",
    subtleMuted: "text-subtle-muted",
    onPrimary: "text-primary-foreground",
    brand: "text-primary",
    brandSoft: "text-primary-soft",
    success: "text-success",
    warning: "text-warning",
    info: "text-info",
    infoSoft: "text-info-soft",
    destructive: "text-destructive",
  },
  bg: {
    base: "bg-background",
    sidebar: "bg-sidebar",
    card: "bg-card",
    surface: "bg-surface",
    surfaceHover: "bg-surface-hover",
    surfaceActive: "bg-surface-active",
    muted: "bg-muted",
    primary: "bg-primary",
    primaryMuted: "bg-primary-muted",
    primarySubtle: "bg-primary-subtle",
    destructiveMuted: "bg-destructive-muted",
    successMuted: "bg-success-muted",
    warningMuted: "bg-warning-muted",
    warningSubtle: "bg-warning-subtle",
  },
  border: {
    default: "border-border",
    muted: "border-border-muted",
    strong: "border-border-strong",
    primary: "border-primary-border",
    destructive: "border-destructive-border",
    success: "border-success-border",
    warning: "border-warning-border",
    info: "border-info-border",
  },
  shadow: {
    sm: "shadow-sm",
    card: "shadow-card",
    primary: "shadow-primary",
    primaryLg: "shadow-primary-lg",
    glowPrimary: "shadow-glow-primary",
    glowPrimaryLg: "shadow-glow-primary-lg",
    glowWarning: "shadow-glow-warning",
    glowInfo: "shadow-glow-info",
  },
  radius: {
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    "3xl": "rounded-3xl",
    full: "rounded-full",
  },
} as const;

export const roleTokens: Record<
  UserRole,
  { ring: string; bg: string; icon: string }
> = {
  super_admin: {
    ring: "ring-role-nacional",
    bg: "bg-role-nacional",
    icon: tokens.text.brand,
  },
  delegado_jueces: {
    ring: "ring-role-jueces",
    bg: "bg-role-jueces",
    icon: tokens.text.info,
  },
  delegado_zona: {
    ring: "ring-role-regional",
    bg: "bg-role-regional",
    icon: tokens.text.warning,
  },
  responsable_financiero_jueces: {
    ring: "ring-role-financiero",
    bg: "bg-role-financiero",
    icon: tokens.text.success,
  },
  solo_ver: {
    ring: "ring-role-lectura",
    bg: "bg-role-lectura",
    icon: tokens.text.subtle,
  },
  juez: {
    ring: "ring-role-lectura",
    bg: "bg-role-lectura",
    icon: tokens.text.subtle,
  },
};

export const selectFieldClass =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm text-foreground shadow-sm transition-[border-color,box-shadow] hover:border-border-strong focus-visible:border-primary-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15";

export const selectFieldClassSm =
  "h-8 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground-secondary shadow-sm transition-[border-color,box-shadow] hover:border-border-strong focus-visible:border-primary-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15";

export const textareaFieldClass =
  "min-h-[72px] w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-subtle-muted shadow-sm transition-[border-color,box-shadow] hover:border-border-strong focus-visible:border-primary-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/15";
