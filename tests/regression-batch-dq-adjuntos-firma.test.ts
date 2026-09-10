import { describe, expect, it } from "vitest";
import { detectImageType } from "@/lib/tickets/validation";
import { extractTicketFiles } from "@/lib/tickets/form";

// `File.type` lo pone el navegador —casi siempre por la extensión— y viaja en
// la petición, así que quien sube el fichero elige lo que dice ser. La ruta de
// adjuntos de tickets solo miraba ese campo, de modo que el bucket aceptaba
// cualquier contenido con solo llamarlo `.png`, y lo guardaba y servía
// declarado como imagen. Ya se comprobaba la firma de los PDF de importación
// (`hasPdfSignature`); esta ruta se había quedado atrás.

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const GIF89 = new Uint8Array([...Buffer.from("GIF89a"), 0x01, 0x00]);
const GIF87 = new Uint8Array([...Buffer.from("GIF87a"), 0x01, 0x00]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 0]);

function ficheroFalso(nombre: string, tipoDeclarado: string, bytes: Uint8Array): File {
  return new File([bytes as unknown as BlobPart], nombre, { type: tipoDeclarado });
}

function formConArchivos(...files: File[]): FormData {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  return fd;
}

describe("detectImageType", () => {
  it("reconoce los cuatro formatos permitidos por su firma", () => {
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(GIF89)).toBe("image/gif");
    expect(detectImageType(GIF87)).toBe("image/gif");
    expect(detectImageType(WEBP)).toBe("image/webp");
  });

  it("no se traga un PNG a medias ni un RIFF que no sea WEBP", () => {
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e]))).toBeNull();
    const riffWav = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WAVE")]);
    expect(detectImageType(riffWav)).toBeNull();
  });

  it("devuelve null con un buffer vacío en vez de reventar", () => {
    expect(detectImageType(new Uint8Array([]))).toBeNull();
    expect(detectImageType(new ArrayBuffer(0))).toBeNull();
  });
});

describe("extractTicketFiles", () => {
  it("rechaza contenido arbitrario disfrazado de imagen", async () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    const { files, error } = await extractTicketFiles(
      formConArchivos(ficheroFalso("foto.png", "image/png", html)),
    );
    expect(files).toHaveLength(0);
    expect(error).toContain("no es una imagen");
    expect(error).toContain("foto.png");
  });

  it("guarda el tipo REAL, no el que declara el navegador", async () => {
    // Caso corriente: una foto JPEG a la que alguien le cambió la extensión.
    const { files, error } = await extractTicketFiles(
      formConArchivos(ficheroFalso("captura.png", "image/png", JPEG)),
    );
    expect(error).toBeNull();
    expect(files).toHaveLength(1);
    // Se sube igual —es una imagen de verdad— pero declarada por lo que es, para
    // que el Content-Type con el que se sirva no mienta.
    expect(files[0]!.contentType).toBe("image/jpeg");
    expect(files[0]!.fileName).toBe("captura.png");
  });

  it("deja pasar los cuatro formatos buenos", async () => {
    const { files, error } = await extractTicketFiles(
      formConArchivos(
        ficheroFalso("a.jpg", "image/jpeg", JPEG),
        ficheroFalso("b.png", "image/png", PNG),
        ficheroFalso("c.gif", "image/gif", GIF89),
        ficheroFalso("d.webp", "image/webp", WEBP),
      ),
    );
    expect(error).toBeNull();
    expect(files.map((f) => f.contentType)).toEqual([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]);
  });

  it("un solo fichero falso tumba el lote entero: no se sube nada a medias", async () => {
    const { files, error } = await extractTicketFiles(
      formConArchivos(
        ficheroFalso("buena.png", "image/png", PNG),
        ficheroFalso("mala.png", "image/png", new TextEncoder().encode("MZ ejecutable")),
      ),
    );
    expect(files).toHaveLength(0);
    expect(error).toContain("mala.png");
  });

  it("el rechazo por tamaño sigue ocurriendo antes de leer un solo byte", async () => {
    // 6 MB de ceros: supera el máximo, así que ni se mira la firma.
    const grande = new Uint8Array(6 * 1024 * 1024);
    const { files, error } = await extractTicketFiles(
      formConArchivos(ficheroFalso("enorme.png", "image/png", grande)),
    );
    expect(files).toHaveLength(0);
    expect(error).toContain("5 MB");
  });
});
