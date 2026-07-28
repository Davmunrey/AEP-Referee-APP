import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { guardRosterWrite } from "@/lib/api/roster-mutation-guard";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { parseSelectedImportKeys } from "@/lib/import-security";
import {
  MAX_PDF_BYTES,
  extractPdfLayoutText,
  validatePdfMime,
} from "@/lib/schedule-parser";
import { parseQuadrantAssignments } from "@/lib/quadrant-parser";
import { looksLikeLayout, parseQuadrantLayout } from "@/lib/quadrant-layout-parser";
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
  const blocked = guardRosterWrite(comp, user);
  if (blocked) return blocked;
  if (!comp) return jsonError("Competición no encontrada", 404);

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
  let isLayout = false;
  try {
    const extracted = await extractPdfLayoutText(buffer);
    text = extracted.text;
    pages = extracted.pages;
    isLayout = extracted.layout;
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
  // Parser por geometría de columnas si el texto conserva la rejilla (-layout);
  // si no detecta candidatos, cae al parser plano heurístico.
  let parsed =
    isLayout && looksLikeLayout(text)
      ? parseQuadrantLayout(text, referees, roster.template)
      : parseQuadrantAssignments(text, referees, roster.template);
  if (parsed.candidates.length === 0) {
    parsed = parseQuadrantAssignments(text, referees, roster.template);
  }
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

  // Un solo lote: carga los datos una vez, valida en memoria de forma
  // incremental y persiste con un upsert masivo (antes: ~6-8 consultas por hueco
  // × N huecos). Se conserva el shape de respuesta y las razones por entrada.
  const applicable = candidates.filter(
    (candidate) => candidate.selected && candidate.slotKey && candidate.refereeId,
  );
  const batch = await dataService.assignRefereesBatch(
    competitionId,
    applicable.map((candidate) => ({
      slotKey: candidate.slotKey!,
      refereeId: candidate.refereeId!,
      flags: candidate.flags,
    })),
    user.nombre,
  );

  let applied = 0;
  const errors: string[] = [];
  applicable.forEach((candidate, index) => {
    const result = batch.results[index];
    if (result?.error) errors.push(`${candidate.session} ${candidate.roleLabel}: ${result.error}`);
    else applied++;
  });

  return jsonOk({
    preview,
    applied,
    errors,
    assignments: batch.assignments,
    flags: batch.flags,
  });
}
