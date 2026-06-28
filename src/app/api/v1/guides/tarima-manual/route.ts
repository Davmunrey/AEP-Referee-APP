import { getSession } from "@/lib/auth/session";
import {
  renderTarimaUserGuidePdf,
} from "@/lib/guides/render-tarima-user-guide-pdf";
import { tarimaUserGuideFilename } from "@/lib/guides/tarima-user-guide-filename";
import { tarimaGuideAppUrl } from "@/lib/guides/tarima-user-guide-content";
import { jsonError } from "@/lib/api/route-utils";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Descarga el manual de usuario AEP Tarima en PDF (requiere sesión). */
export async function GET() {
  const user = await getSession();
  if (!user) {
    return jsonError("Inicia sesión para descargar el manual.", 401);
  }

  try {
    const pdf = await renderTarimaUserGuidePdf(tarimaGuideAppUrl());
    if (!pdf?.length) {
      return jsonError("El PDF generado está vacío.", 500);
    }

    const filename = tarimaUserGuideFilename();
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err) {
    console.error("[tarima-manual] PDF generation failed:", err);
    return jsonError(
      err instanceof Error ? err.message : "Error al generar el manual PDF",
      500,
    );
  }
}
