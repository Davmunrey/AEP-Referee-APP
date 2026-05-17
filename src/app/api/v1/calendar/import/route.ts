import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { parseAepCalendarText } from "@/lib/calendar-parser";
import { competitionDedupKey } from "@/lib/competition-dedup";
import {
  MAX_PDF_BYTES,
  extractPdfText,
  validatePdfMime,
} from "@/lib/schedule-parser";
import type { Competition } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { dataService } from "@/server/services";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Importa el PDF del Calendario AEP anual y crea (en preview / apply) las competiciones de
 * ámbito español (AEP1/AEP2/AEP3). Solo `super_admin` y `delegado_jueces` pueden ejecutar.
 *
 * Filtros aplicados al crear:
 *   - tipo ∈ {AEP-1, AEP-2, AEP-3}
 *   - localidad/organizador no extranjero (sin "Finland", "Malta", etc.)
 *   - fecha inicio parseable (entries `pendiente` se descartan en apply)
 *   - no duplica eventos con la misma combinación (nombre + fecha + tipo) que ya existan en BD
 *   - en apply: limpia duplicados previos en BD (misma clave) antes de crear nuevos
 */
export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role !== "super_admin" && user.role !== "delegado_jueces") {
    return jsonError("Solo Super Admin o Delegado de Jueces pueden importar el calendario", 403);
  }

  const url = new URL(request.url);
  const apply = url.searchParams.get("apply") === "true";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Se esperaba multipart/form-data", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return jsonError("Falta el campo 'file' con el PDF", 400);
  }
  const filename =
    file instanceof File && typeof file.name === "string" ? file.name : "calendario.pdf";

  const mimeError = validatePdfMime(file.type);
  if (mimeError) return jsonError(mimeError, 400);
  if (file.size > MAX_PDF_BYTES) {
    return jsonError(
      `El PDF excede el tamaño máximo (${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB)`,
      400,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text = "";
  try {
    const extracted = await extractPdfText(buffer);
    text = extracted.text;
  } catch (e) {
    return jsonError(
      `No se pudo leer el PDF: ${e instanceof Error ? e.message : "error desconocido"}`,
      400,
    );
  }

  const parsed = parseAepCalendarText(text);

  // Filtro España: tipo AEP-1/2/3 y no extranjero.
  const elegibles = parsed.entries.filter((e) => e.esEspaña && e.tipo !== null);

  let dedupeRemoved = 0;
  if (apply) {
    const dedupe = await dataService.removeDuplicateCompetitions(user);
    dedupeRemoved = dedupe.removed.length;
  }

  const existing = await dataService.getCompetitions(user);
  const dbDuplicateGroups = await dataService.findCompetitionDuplicates(user);
  const dbDuplicateCount = dbDuplicateGroups.reduce(
    (n, g) => n + g.events.length - 1,
    0,
  );

  const existingKeys = new Set(existing.map((c) => competitionDedupKey(c)));

  const toCreate = elegibles.filter((e) => {
    if (!e.fechaInicio || !e.tipo) return false;
    const key = competitionDedupKey({
      nombre: e.nombre,
      fecha: e.fechaInicio,
      tipo: e.tipo,
    });
    return !existingKeys.has(key);
  });

  const preview = {
    filename,
    year: parsed.year,
    totalDetected: parsed.entries.length,
    eligibleCount: elegibles.length,
    duplicateCount: elegibles.length - toCreate.length,
    dbDuplicateCount,
    toCreateCount: toCreate.length,
    warnings: parsed.warnings,
    entries: elegibles.map((e) => ({
      rawDate: e.rawDate,
      fechaInicio: e.fechaInicio,
      fechaFin: e.fechaFin,
      nombre: e.nombre,
      localidad: e.localidad,
      organizador: e.organizador,
      tipo: e.tipo,
      zona: e.zona,
      pendiente: e.pendiente,
      nuevo: !!(
        e.fechaInicio &&
        e.tipo &&
        !existingKeys.has(
          competitionDedupKey({
            nombre: e.nombre,
            fecha: e.fechaInicio,
            tipo: e.tipo,
          }),
        )
      ),
    })),
  };

  if (!apply) return jsonOk({ preview });

  const created: Competition[] = [];
  const errors: string[] = [];
  for (const entry of toCreate) {
    if (!entry.fechaInicio || !entry.tipo) continue;
    try {
      const comp = await dataService.createCompetition({
        nombre: entry.nombre,
        tipo: entry.tipo,
        fecha: entry.fechaInicio,
        fechaFin: entry.fechaFin ?? entry.fechaInicio,
        sede: entry.localidad,
        sesiones: entry.tipo === "AEP-1" ? 4 : entry.tipo === "AEP-2" ? 3 : 2,
        requeridos:
          entry.tipo === "AEP-1" ? 12 : entry.tipo === "AEP-2" ? 9 : 6,
        zona: entry.zona,
      });
      created.push(comp);
    } catch (e) {
      errors.push(
        `${entry.nombre}: ${e instanceof Error ? e.message : "error desconocido"}`,
      );
    }
  }

  revalidatePath("/events");
  revalidatePath("/");
  return jsonOk({
    preview,
    created: created.length,
    dedupeRemoved,
    errors,
  });
}
