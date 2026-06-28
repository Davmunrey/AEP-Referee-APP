import { getSession } from "@/lib/auth/session";
import {
  renderTarimaUserGuidePdf,
  tarimaUserGuideFilename,
} from "@/lib/guides/render-tarima-user-guide-pdf";
import { tarimaGuideAppUrl } from "@/lib/guides/tarima-user-guide-content";

export const runtime = "nodejs";

/** Descarga el manual de usuario AEP Tarima en PDF (requiere sesión). */
export async function GET() {
  const user = await getSession();
  if (!user) {
    return new Response("No autorizado", { status: 401 });
  }

  const pdf = await renderTarimaUserGuidePdf(tarimaGuideAppUrl());
  const filename = tarimaUserGuideFilename();

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
