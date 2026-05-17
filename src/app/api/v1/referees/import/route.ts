import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { parseJudgesRegistryXlsx } from "@/lib/judges-registry";
import { dataService } from "@/server/services";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!isSessionUser(user)) return user;
  if (user.role !== "super_admin" && user.role !== "delegado_jueces") {
    return jsonError("Solo Super Admin o Delegado de Jueces pueden importar el registro", 403);
  }

  const url = new URL(request.url);
  const replace = url.searchParams.get("replace") === "true";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Se esperaba multipart/form-data", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return jsonError("Falta el campo 'file' con el Excel", 400);
  }
  if (file.size > MAX_BYTES) {
    return jsonError("El archivo excede 8 MB", 400);
  }

  const buffer = await file.arrayBuffer();
  let parsed;
  try {
    parsed = parseJudgesRegistryXlsx(buffer);
  } catch (e) {
    return jsonError(
      `No se pudo leer el Excel: ${e instanceof Error ? e.message : "error"}`,
      400,
    );
  }

  if (parsed.referees.length === 0) {
    return jsonError("No se encontraron jueces en la hoja «Datos»", 400);
  }

  const result = await dataService.importJudgesRegistry(parsed, { replace });

  return jsonOk({
    preview: {
      referees: parsed.referees.length,
      competitions: parsed.competitions.length,
    },
    ...result,
  });
}
