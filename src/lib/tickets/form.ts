// Extrae y valida los ficheros adjuntos de un multipart/form-data de tickets.
// Se valida ANTES de leer los bytes/subir nada (tipo, tamaño y número máximo).
import { detectImageType, type FileMeta, validateFiles } from "./validation";
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

  // Segunda vuelta, ya con los bytes: el tipo que declara el navegador no
  // prueba nada —lo elige quien sube el fichero—, así que se mira la firma y se
  // guarda el tipo DETECTADO. Va después de `validateFiles` a propósito: el
  // tamaño y el número se rechazan sin llegar a leer un solo byte.
  const files: TicketFileInput[] = [];
  for (const file of raw) {
    const bytes = await file.arrayBuffer();
    const tipoReal = detectImageType(bytes);
    if (!tipoReal) {
      return {
        files: [],
        error: `«${file.name}» no es una imagen JPG, PNG, WEBP o GIF, diga lo que diga su extensión.`,
      };
    }
    files.push({
      fileName: file.name,
      contentType: tipoReal,
      size: file.size,
      bytes,
    });
  }
  return { files, error: null };
}
