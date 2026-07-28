// Extrae y valida los ficheros adjuntos de un multipart/form-data de tickets.
// Se valida ANTES de leer los bytes/subir nada (tipo, tamaño y número máximo).
import { type FileMeta, validateFiles } from "./validation";
import type { TicketFileInput } from "./service-types";

export async function extractTicketFiles(
  formData: FormData,
  field = "files",
): Promise<{ files: TicketFileInput[]; error: string | null }> {
  const raw = formData
    .getAll(field)
    .filter((value): value is File => value instanceof File && value.size > 0);

  const metas: FileMeta[] = raw.map((file) => ({
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  }));
  const error = validateFiles(metas);
  if (error) return { files: [], error };

  const files: TicketFileInput[] = [];
  for (const file of raw) {
    files.push({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      bytes: await file.arrayBuffer(),
    });
  }
  return { files, error: null };
}
