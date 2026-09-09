import { canManageCompensation } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, readOrError } from "@/lib/api/route-utils";
import {
  RECEIPT_DATE_UNKNOWN,
  compensationReceiptFilename,
  formatCompetitionDatePhrase,
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

  const leido = await readOrError(
    "compensation.export.lectura",
    "No se pudieron cargar los datos del recibo",
    () =>
      Promise.all([
        dataService.getCompetition(id),
        dataService.getRoster(id),
        dataService.getReferee(refereeId),
      ]),
  );
  if (leido instanceof Response) return leido;
  const [competition, roster, referee] = leido;

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
  if (organizer.type === "custom" && (!organizer.entityName.trim() || !organizer.emails.trim())) {
    return jsonError(
      "Configura el nombre y el e-mail del organizador personalizado antes de exportar",
      422,
    );
  }

  const claim = await readOrError(
    "compensation.export.claim",
    "No se pudo cargar la liquidación del juez",
    () => dataService.getCompensationClaimForExport(id, refereeId),
  );
  if (claim instanceof Response) return claim;
  if (!claim) return jsonError("Claim no encontrado", 404);

  if (!claim.financialComplete) {
    // Sin «(o marca comparte vehículo)»: esa casilla exime del COBRO del
    // kilometraje, no de anotarlo, porque el alojamiento se decide por la
    // distancia. Quien seguía ese consejo la marcaba y volvía a leer lo mismo.
    return jsonError(
      "Completa los km de desplazamiento de este juez antes de exportar el recibo. Marcar «comparte vehículo» exime del cobro del kilometraje, pero los km siguen haciendo falta para calcular el alojamiento.",
      422,
    );
  }

  // `NaN <= 0` es `false`: un importe ilegible se colaba por el guarda de
  // «importe positivo» y salía impreso en el recibo como «NaN€», en un PDF que
  // va al juez y al club. Se exige un número finito, no solo uno que no sea
  // menor o igual que cero.
  // Un recibo sin fecha de campeonato imprimía «el día undefined de undefined
  // de 0». Es un documento que va al juez y al club: si la fecha no está, se
  // dice aquí en vez de imprimir un hueco con forma de dato.
  if (formatCompetitionDatePhrase(competition.fecha, competition.fechaFin) === RECEIPT_DATE_UNKNOWN) {
    return jsonError(
      "El campeonato no tiene una fecha válida; corrígela antes de exportar el recibo",
      422,
    );
  }

  if (!Number.isFinite(claim.totalAmount) || claim.totalAmount <= 0) {
    return jsonError(
      "El importe calculado no es un número válido o es cero; revisa la tarima y los datos de compensación",
      422,
    );
  }

  // Dibujar el PDF puede fallar por su cuenta (una fuente que no carga, un
  // texto que no cabe). Sin `catch`, eso salía de Next como un 500 sin cuerpo
  // JSON, y el cliente enseñaba un error genérico donde esperaba un recibo.
  const pdf = await readOrError(
    "compensation.export.pdf",
    "No se pudo generar el recibo en PDF. Vuelve a intentarlo.",
    () =>
      renderCompensationReceiptPdf({
        refereeName: referee.nombre,
        amountEur: claim.totalAmount,
        competitionName: competition.nombre,
        sede: competition.sede,
        fecha: competition.fecha,
        fechaFin: competition.fechaFin,
        iban,
        organizer,
      }),
  );
  if (pdf instanceof Response) return pdf;

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
