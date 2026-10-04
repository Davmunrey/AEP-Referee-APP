import { BRAND } from "@/lib/document-tokens";

/** Metadatos y colores de marca AEP Tarima (correos, documentación). */
export const AEP_TARIMA_OFFICIAL_URL = "https://aep-tarima.vercel.app";

export const AEP_BRANDING = {
  association: "ASOCIACIÓN ESPAÑOLA DE POWERLIFTING (AEP)",
  contactEmail: "powerhispania@gmail.com",
  /** Colores de los correos: los tokens de marca de `document-tokens.ts`. */
  colors: {
    red: BRAND.red,
    redLight: BRAND.redSoft,
    text: BRAND.ink,
    muted: BRAND.muted,
    border: BRAND.border,
    surface: BRAND.surface,
    white: BRAND.paper,
  },
} as const;
