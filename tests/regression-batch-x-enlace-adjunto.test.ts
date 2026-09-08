import { describe, expect, it } from "vitest";
import { isSafeExternalUrlOrEmpty, safeExternalUrl } from "@/lib/safe-url";

describe("enlace adjunto de un informe", () => {
  it("acepta enlaces navegables reales", () => {
    expect(safeExternalUrl("https://aep.es/acta.pdf")).toBe("https://aep.es/acta.pdf");
    expect(safeExternalUrl("http://192.168.1.10/acta.pdf")).toBe("http://192.168.1.10/acta.pdf");
    expect(safeExternalUrl("mailto:jueces@aep.es")).toBe("mailto:jueces@aep.es");
    expect(safeExternalUrl("  https://aep.es/a.pdf  ")).toBe("https://aep.es/a.pdf");
  });

  it("rechaza los esquemas que ejecutan código", () => {
    // Guardado tal cual, el navegador ejecutaba esto en el origen de la
    // aplicación al pulsar «Ver documento adjunto».
    expect(safeExternalUrl("javascript:alert(document.cookie)")).toBeNull();
    expect(safeExternalUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("rechaza lo que no es una URL absoluta", () => {
    expect(safeExternalUrl("//evil.example")).toBeNull();
    expect(safeExternalUrl("/informes/1")).toBeNull();
    expect(safeExternalUrl("no es una url")).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });

  it("el campo es opcional: vacío o ausente es válido para la API", () => {
    expect(isSafeExternalUrlOrEmpty(undefined)).toBe(true);
    expect(isSafeExternalUrlOrEmpty("")).toBe(true);
    expect(isSafeExternalUrlOrEmpty("   ")).toBe(true);
    expect(isSafeExternalUrlOrEmpty("https://aep.es/a.pdf")).toBe(true);
    expect(isSafeExternalUrlOrEmpty("javascript:alert(1)")).toBe(false);
  });
});
