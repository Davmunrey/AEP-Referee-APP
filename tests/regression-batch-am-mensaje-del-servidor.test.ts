import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENTS = join(process.cwd(), "src/components");

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

// Formas de enseñarle algo al usuario tras un fallo.
const SHOWS_MESSAGE = /\b(onStatus|setStatusMsg|setError|setStatusIsError|alert)\s*\(/;

describe("un catch que enseña un mensaje no puede tirar el del servidor", () => {
  // El servidor dice qué falta —«define una plantilla», «quedan 3 huecos», la
  // tarima está bloqueada por un pago—, y en el envío a aprobación el catch
  // descartaba el error y dejaba solo «Error al enviar la propuesta»: un
  // callejón sin salida donde había una instrucción concreta.
  it("ningún componente descarta el error y aun así avisa", () => {
    const offenders: string[] = [];
    for (const path of tsxFiles(COMPONENTS)) {
      const lines = readFileSync(path, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        // `catch {` sin ligar el error: si el bloque enseña algo, lo enseña sin
        // lo que dijo el servidor.
        if (!/}\s*catch\s*\{\s*$/.test(line)) return;
        const block = lines.slice(i + 1, i + 6).join("\n");
        if (SHOWS_MESSAGE.test(block)) {
          offenders.push(`${path.replace(process.cwd() + "/", "")}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("el envío a aprobación usa formatApiError", () => {
    const src = readFileSync(
      join(COMPONENTS, "competitions/roster-header-actions.tsx"),
      "utf8",
    );
    expect(src).toContain("formatApiError(err, \"Error al enviar la propuesta\")");
    expect(src).toContain("formatApiError(err, \"Error al guardar el borrador\")");
  });
});
