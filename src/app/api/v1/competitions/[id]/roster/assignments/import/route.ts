import { canEditRoster } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { parseSelectedImportKeys } from "@/lib/import-security";
import {
  MAX_PDF_BYTES,
  extractPdfText,
  validatePdfMime,
} from "@/lib/schedule-parser";
import { parseQuadrantAssignments } from "@/lib/quadrant-parser";
import { dataService } from "@/server/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;

  const { id: competitionId } = await context.params;
  const comp = await dataService.getCompetition(competitionId);
  if (!comp) return jsonError("Competición no encontrada", 404);
  if (!canEditRoster(user, comp.zona)) return jsonError("Sin permiso en esta zona", 403);

  const apply = new URL(request.url).searchParams.get("apply") === "true";

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
  if (!(file instanceof Blob)) return jsonError("Falta el campo 'file' con el PDF", 400);
  const filename =
    file instanceof File && typeof file.name === "string" ? file.name : "cuadrante.pdf";

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

  const roster = await dataService.getRoster(competitionId);
  if (!roster?.template.length) {
    return jsonError("La competición no tiene plantilla. Importa o crea plantilla primero.", 422);
  }

  const referees = await dataService.getReferees({ user });
  const parsed = parseQuadrantAssignments(text, referees, roster.template);
  const defaultSelected = new Set(
    parsed.candidates.filter((c) => c.importable).map((c) => c.key),
  );
  const effectiveSelected = selectedKeys ?? defaultSelected;
  const candidates = parsed.candidates.map((candidate) => ({
    ...candidate,
    selected: effectiveSelected.has(candidate.key) && candidate.importable,
  }));

  const preview = {
    filename,
    pages,
    detectedCount: candidates.length,
    importableCount: candidates.filter((c) => c.importable).length,
    selectedCount: candidates.filter((c) => c.selected).length,
    warnings: parsed.warnings,
    candidates,
  };

  if (!apply) return jsonOk({ preview });

  let applied = 0;
  const errors: string[] = [];
  for (const candidate of candidates) {
    if (!candidate.selected || !candidate.slotKey || !candidate.refereeId) continue;
    const result = await dataService.assignReferee(
      competitionId,
      candidate.slotKey,
      candidate.refereeId,
      user.nombre,
      candidate.flags,
    );
    if (result.error) errors.push(`${candidate.session} ${candidate.roleLabel}: ${result.error}`);
    else applied++;
  }

  const updatedRoster = await dataService.getRoster(competitionId);
  return jsonOk({
    preview,
    applied,
    errors,
    assignments: updatedRoster?.assignments ?? {},
    flags: updatedRoster?.flags ?? {},
  });
}
