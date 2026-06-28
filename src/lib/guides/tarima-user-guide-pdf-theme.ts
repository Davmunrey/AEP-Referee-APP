/** Colores y medidas del manual PDF (alineados con tokens AEP Tarima). */
export const PDF_THEME = {
  red: "#c8362a",
  redLight: "#fbe6e3",
  redDark: "#9e2b22",
  text: "#1c1916",
  textSecondary: "#46413a",
  muted: "#837c72",
  border: "#e3dfd8",
  surface: "#faf9f7",
  white: "#ffffff",
  margin: 52,
  contentWidth: 491, // A4 595 - 2*52
} as const;

export const PDF_FONTS = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
} as const;
