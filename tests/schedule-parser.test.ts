import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  parseAepHorarioText,
  parsedToRosterTemplate,
  parseScheduleFilename,
} from "@/lib/schedule-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(
  resolve(__dirname, "fixtures/horario-junior-aep1.txt"),
  "utf8",
);

describe("parseAepHorarioText (Junior AEP-1)", () => {
  const parsed = parseAepHorarioText(FIXTURE);

  it("detecta cabecera del documento", () => {
    expect(parsed.header.tipo).toBe("AEP-1");
    expect(parsed.header.sede?.toLowerCase()).toContain("torres de cotillas");
    expect(parsed.header.fechasTexto).toMatch(/2026/);
  });

  it("detecta los tres días del campeonato", () => {
    expect(parsed.days.map((d) => d.short)).toEqual([
      "Viernes",
      "Sábado",
      "Domingo",
    ]);
    expect(parsed.days[0].iso).toBe("2026-05-15");
  });

  it("detecta exactamente 10 sesiones (S1–S10)", () => {
    expect(parsed.sessions.map((s) => s.sesion)).toEqual([
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "S6",
      "S7",
      "S8",
      "S9",
      "S10",
    ]);
  });

  it("S1 tiene horario y dos grupos", () => {
    const s1 = parsed.sessions[0];
    expect(s1.horarioPesaje).toBe("10:30 - 12:00");
    expect(s1.horarioCompeticion).toBe("12:30 - 15:45");
    expect(s1.totalLevantadores).toBe(25);
    expect(s1.grupos.map((g) => g.nombre)).toEqual(["Grupo 1", "Grupo 2"]);
    expect(s1.grupos[0].levantadores).toBe(13);
    expect(s1.grupos[1].levantadores).toBe(12);
  });

  it("S4 tiene categorías mixtas Mujeres + Hombres", () => {
    const s4 = parsed.sessions.find((s) => s.sesion === "S4")!;
    expect(s4.dia.short).toBe("Sábado");
    expect(s4.categorias.length).toBeGreaterThanOrEqual(2);
    const generos = s4.categorias.map((c) => c.genero);
    expect(generos).toContain("Mujeres");
    expect(generos).toContain("Hombres");
    // Grupo 1 mezcla Mujeres -57kg con Hombres -105kg
    const g1 = s4.grupos[0];
    expect(g1.levantadores).toBe(14);
    expect(g1.categorias.length).toBe(2);
  });

  it("ignora 'Entrega medallas' y cabeceras repetidas", () => {
    expect(parsed.warnings).toEqual([]);
  });
});

describe("parsedToRosterTemplate", () => {
  const parsed = parseAepHorarioText(FIXTURE);
  const template = parsedToRosterTemplate(parsed, "AEP-1");

  it("genera una sesión por SESIÓN parseada", () => {
    expect(template).toHaveLength(parsed.sessions.length);
  });

  it("AEP-1 incluye Jurado y bloque de pesaje", () => {
    const s1 = template[0];
    expect(s1.roles.some((r) => r.key === "jurado")).toBe(true);
    expect(s1.pesajeRoles.some((r) => r.key === "pesaje")).toBe(true);
  });

  it("preserva días y horarios", () => {
    const s1 = template[0];
    expect(s1.dia).toBe("Viernes");
    expect(s1.horarioCompeticion).toBe("12:30 - 15:45");
    expect(s1.horarioPesaje).toBe("10:30 - 12:00");
  });

  it("propaga grupos al template", () => {
    const s1 = template[0];
    expect(s1.grupos?.length).toBe(2);
    expect(s1.grupos?.[0].levantadores).toBe(13);
  });
});

describe("parseScheduleFilename", () => {
  it("extrae tipo y fecha del nombre AEP", () => {
    const meta = parseScheduleFilename(
      "20260517_AEP1_Horario-Junior_rev3.pdf",
    );
    expect(meta.tipo).toBe("AEP-1");
    expect(meta.fechaSugerida).toBe("2026-05-17");
    expect(meta.subtitulo?.toLowerCase()).toContain("junior");
  });

  it("ignora nombres no AEP", () => {
    const meta = parseScheduleFilename("documento.pdf");
    expect(meta.tipo).toBeUndefined();
    expect(meta.fechaSugerida).toBeUndefined();
  });
});
