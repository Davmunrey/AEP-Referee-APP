import { canManageCompensation } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError } from "@/lib/api/route-utils";
import {
  buildClaimBreakdown,
  compensationReceiptFilename,
  isValidSpanishIban,
  renderCompensationReceiptPdf,
} from "@/lib/judge-compensation";
import { receiptOrganizerFromCompetition } from "@/server/services/compensation-helpers";
import { dataService } from "@/server/services";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string; refereeId: string }>;
}

/**
 * Genera el PDF del recibo de compensación. El IBAN se recibe en el cuerpo y
 * no se almacena ni registra en ningún sitio de la aplicación.
 */
export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (!canManageCompensation(user)) return jsonError("Sin permiso", 403);

  const { id, refereeId } = await context.params;
  const body = await request.json().catch(() => null);
  const iban = typeof body?.iban === "string" ? body.iban.trim() : "";
  if (!iban) return jsonError("Indica el IBAN para generar el recibo", 400);
  if (!isValidSpanishIban(iban)) return jsonError("IBAN español no válido", 400);

  const [competition, roster, referee] = await Promise.all([
    dataService.getCompetition(id),
    dataService.getRoster(id),
    dataService.getReferee(refereeId),
  ]);

  if (!competition || !roster || !referee) {
    return jsonError("Campeonato, tarima o juez no encontrado", 404);
  }

  const organizer = receiptOrganizerFromCompetition(competition);
  if (organizer.type === "club" && !organizer.clubEmail) {
    return jsonError(
      "Configura el e-mail del club organizador en el campeonato antes de exportar",
      422,
    );
  }

  const claim = await dataService.getCompensationClaimForExport(id, refereeId);
  if (!claim) return jsonError("Claim no encontrado", 404);

  if (!claim.financialComplete) {
    return jsonError(
      "Completa los km de desplazamiento (o marca comparte vehículo) antes de exportar el recibo",
      422,
    );
  }

  if (claim.totalAmount <= 0) {
    return jsonError("El importe calculado es cero; revisa la tarima y los datos de compensación", 422);
  }

  const pdf = await renderCompensationReceiptPdf({
    refereeName: referee.nombre,
    amountEur: claim.totalAmount,
    competitionName: competition.nombre,
    sede: competition.sede,
    fecha: competition.fecha,
    fechaFin: competition.fechaFin,
    iban,
    organizer,
    breakdownLines: buildClaimBreakdown(claim),
  });

  const filename = compensationReceiptFilename(referee.nombre, competition.nombre);
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
