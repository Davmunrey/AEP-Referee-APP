import { TARIMA_GUIDE_META } from "@/lib/guides/tarima-user-guide-content";

/** Nombre de archivo estable pero versionado para evitar caché del navegador con PDFs antiguos. */
export function tarimaUserGuideFilename(): string {
  return `Manual-AEP-Tarima-Gestion-Jueces-v${TARIMA_GUIDE_META.guideVersion}.pdf`;
}
