import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { loadCompetitionForRosterWrite } from "@/lib/api/roster-mutation-guard";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { parseSelectedImportKeys } from "@/lib/import-security";
import {
  duplicateRoleKeys,
  duplicateSessionCodes,
  mergeRosterTemplateSessions,
} from "@/lib/roster-template";
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
  const comp = await loadCompetitionForRosterWrite(competitionId, user, "roster.template.import");
  if (comp instanceof Response) return comp;

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
    return jsonError(
      e instanceof SyntaxError ? "Selección inválida" : e instanceof Error ? e.message : "Selección inválida",
      400,
    );
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
  // El tipo decide QUÉ ROLES monta la plantilla, y el PDF gana sobre lo que
  // dice el campeonato. Si discrepan —el PDF equivocado, o una cabecera mal
  // leída— la tarima se rehacía con los puestos de otro nivel sin que nada lo
  // dijera: el tipo salía como un dato más entre cinco números de la vista
  // previa. Y el dinero no lo sigue: los conceptos de la liquidación se
  // calculan con `competition.tipo`, no con este.
  const avisos = [...parsed.warnings];
  if (tipo !== comp.tipo) {
    avisos.unshift(
      `El horario es de un ${tipo} y este campeonato está registrado como ${comp.tipo}. La plantilla se montará con los puestos de ${tipo}, pero las dietas se calculan con ${comp.tipo}. Comprueba que es el PDF correcto antes de aplicar.`,
    );
  }
  const template = parsedToRosterTemplate(parsed, tipo);
  const selectedTemplate = selectedKeys
    ? template.filter((session) => selectedKeys.has(session.sesion))
    : template;

  if (template.length === 0) {
    return jsonError("El PDF no contenía sesiones reconocibles", 422, {
      warnings: avisos,
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
    warnings: avisos,
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

  // Guardar la plantilla a mano pasa por `rosterTemplateSchema`, que impide dos
  // sesiones con el mismo código; esta ruta no pasaba por ahí. Un PDF con la
  // sesión repetida —o una fusión que la duplicara— dejaba la plantilla en el
  // estado que esa regla existe para evitar: el juez asignado a una sesión
  // aparece en la otra y los huecos de la segunda no existen.
  const repetidas = duplicateSessionCodes(templateToSave);
  if (repetidas.length > 0) {
    return jsonError(
      `El cuadrante trae dos sesiones con el mismo código (${repetidas.join(", ")}). Corrígelo en el PDF o importa las sesiones por separado.`,
      422,
      { preview },
    );
  }

  // La otra mitad de la misma regla, que se había quedado fuera: dentro de una
  // sesión cada rol va en UNA fila con su número de plazas. Dos filas «Juez
  // Central» comparten las claves `${sesion}_${rol}_${indice}`, así que la
  // segunda no aporta huecos. `rosterTemplateSchema` lo rechaza al guardar a
  // mano y el editor deshabilita el botón; por aquí entraba, y quien lo
  // importaba se encontraba una plantilla que el editor ya no le dejaba
  // guardar hasta quitar la fila de más.
  const rolesRepetidos = templateToSave
    .map((sesion) => ({ sesion: sesion.sesion, repetidos: duplicateRoleKeys(sesion) }))
    .filter((entry) => entry.repetidos.length > 0);
  if (rolesRepetidos.length > 0) {
    const detalle = rolesRepetidos
      .map((entry) => `${entry.sesion} (${entry.repetidos.join(", ")})`)
      .join("; ")
    return jsonError(
      `El cuadrante repite un rol dentro de la misma sesión: ${detalle}. Cada rol va en una sola fila con su número de plazas.`,
      422,
      { preview },
    );
  }

  const saved = await dataService.saveCompetitionTemplate(
    competitionId,
    templateToSave,
    user.nombre,
  );
  if (!saved) return jsonError("No se pudo guardar la plantilla", 400);

  return jsonOk({ preview, ...saved });
}
