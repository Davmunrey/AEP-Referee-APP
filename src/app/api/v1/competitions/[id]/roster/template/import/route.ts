import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { guardRosterWrite } from "@/lib/api/roster-mutation-guard";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { parseSelectedImportKeys } from "@/lib/import-security";
import { mergeRosterTemplateSessions } from "@/lib/roster-template";
import {
  MAX_PDF_BYTES,
  extractPdfText,
  parseAepHorarioText,
  parseScheduleFilename,
  parsedToRosterTemplate,
  validatePdfMime,
} from "@/lib/schedule-parser";
import type { EventType } from "@/lib/types";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Importa un horario AEP en PDF y devuelve la plantilla generada (`RosterSession[]`).
 * `multipart/form-data` con campo `file`. Query opcional `?apply=true` para persistir
 * la plantilla con `saveCompetitionTemplate`.
 */
export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await dataService.getCompetition(competitionId);
  const blocked = guardRosterWrite(comp, user);
  if (blocked) return blocked;
  if (!comp) return jsonError("Competición no encontrada", 404);

  const url = new URL(request.url);
  const apply = url.searchParams.get("apply") === "true";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Se esperaba multipart/form-data", 400);
  }

  let selectedKeys: Set<string> | null = null;
  try {
    selectedKeys = parseSelectedImportKeys(formData.get("selectedKeys"));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Selección inválida", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return jsonError("Falta el campo 'file' con el PDF", 400);
  }
  const filename =
    file instanceof File && typeof file.name === "string" ? file.name : "horario.pdf";

  const mimeError = validatePdfMime(file.type);
  if (mimeError) return jsonError(mimeError, 400);
  if (file.size > MAX_PDF_BYTES) {
    return jsonError(
      `El PDF excede el tamaño máximo (${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB)`,
      400,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let pages = 0;
  let text = "";
  try {
    const extracted = await extractPdfText(buffer);
    text = extracted.text;
    pages = extracted.pages;
  } catch (e) {
    return jsonError(
      `No se pudo leer el PDF: ${e instanceof Error ? e.message : "error desconocido"}`,
      400,
    );
  }

  const fileMeta = parseScheduleFilename(filename);
  const parsed = parseAepHorarioText(text);
  const tipo: EventType = parsed.header.tipo ?? fileMeta.tipo ?? comp.tipo;
  const template = parsedToRosterTemplate(parsed, tipo);
  const selectedTemplate = selectedKeys
    ? template.filter((session) => selectedKeys.has(session.sesion))
    : template;

  if (template.length === 0) {
    return jsonError("El PDF no contenía sesiones reconocibles", 422, {
      warnings: parsed.warnings,
      pages,
    });
  }

  const preview = {
    filename,
    pages,
    fileMeta,
    header: parsed.header,
    days: parsed.days,
    sessions: parsed.sessions,
    warnings: parsed.warnings,
    tipoDetected: tipo,
    sessionCount: template.length,
    selectedCount: selectedTemplate.length,
  };

  if (!apply) {
    return jsonOk({ preview, template });
  }

  if (selectedTemplate.length === 0) {
    return jsonError("Selecciona al menos una sesión para aplicar", 400, { preview });
  }

  let templateToSave = selectedTemplate;
  if (selectedKeys) {
    const existing = (await dataService.getRoster(competitionId))?.template ?? [];
    templateToSave = mergeRosterTemplateSessions(existing, selectedTemplate, selectedKeys);
  }

  const saved = await dataService.saveCompetitionTemplate(
    competitionId,
    templateToSave,
    user.nombre,
  );
  if (!saved) return jsonError("No se pudo guardar la plantilla", 400);

  return jsonOk({ preview, ...saved });
}
