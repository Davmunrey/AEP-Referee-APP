import { describe, expect, it } from "vitest";
import { parseAepHorarioText } from "@/lib/schedule-parser/parse-aep-horario-text";
import { parseScheduleFilename } from "@/lib/schedule-parser/parse-filename";
import { canApplyPreview } from "@/lib/import-export-ui";

// Ronda 6: parsers e importadores. El PDF de horarios y el Excel del censo son
// entrada externa, así que aquí un fallo silencioso se convierte en datos malos
// guardados sin que nadie lo note.

function horarioCon(dia: string): string {
  return [
    "ASOCIACIÓN ESPAÑOLA DE POWERLIFTING",
    "Madrid | Comunidad de Madrid",
    dia,
    "SESIÓN 1: Hombres -74",
    "Pesaje 08:00 - 09:30 / Inicio 10:00 / Fin 13:00",
  ].join("\n");
}

describe("parse-aep-horario-text — día de la sesión", () => {
  it("normaliza los cuatro formatos de día que acepta el parser", () => {
    // Antes se cortaba por la coma, así que solo el primero salía bien y los
    // otros tres se colaban enteros como nombre del día, tal cual, hasta el
    // editor de plantilla y el cuadrante.
    for (const raw of [
      "Sábado, 17 de mayo de 2026",
      "Sáb. 17 de mayo de 2026",
      "Sabado 17 de mayo de 2026",
      "Sáb 17 de mayo de 2026",
    ]) {
      const parsed = parseAepHorarioText(horarioCon(raw));
      expect(parsed.sessions[0]?.dia.short, raw).toBe("Sábado");
    }
  });

  it("distingue martes de miércoles pese al prefijo común", () => {
    expect(parseAepHorarioText(horarioCon("Mar. 19 de mayo de 2026")).sessions[0]?.dia.short).toBe(
      "Martes",
    );
    expect(parseAepHorarioText(horarioCon("Mié. 20 de mayo de 2026")).sessions[0]?.dia.short).toBe(
      "Miércoles",
    );
  });

  it("descarta una fecha que no existe en el calendario", () => {
    // "2026-02-31" tiene el formato correcto, así que ninguna capa posterior lo
    // rechazaba.
    const parsed = parseAepHorarioText(horarioCon("Sábado, 31 de febrero de 2026"));
    expect(parsed.sessions[0]?.dia.iso).toBeUndefined();
    expect(parseAepHorarioText(horarioCon("Sábado, 17 de mayo de 2026")).sessions[0]?.dia.iso).toBe(
      "2026-05-17",
    );
  });
});

describe("parseScheduleFilename", () => {
  it("lee tipo, fecha y subtítulo", () => {
    expect(parseScheduleFilename("20260517_AEP1_Horario-Junior_rev3.pdf")).toEqual({
      tipo: "AEP-1",
      fechaSugerida: "2026-05-17",
      subtitulo: "Junior",
    });
  });

  it("no inventa tipos de campeonato que no existen", () => {
    // Con `\d` un "_AEP7_" producía el tipo "AEP-7", que viajaba hasta la
    // creación del campeonato para morir allí en un 400.
    expect(parseScheduleFilename("20260517_AEP7_Horario.pdf")).toEqual({});
  });
});

describe("canApplyPreview", () => {
  it("un Excel con solo campeonatos se puede importar", () => {
    expect(canApplyPreview({ refereeCount: 0, competitionCount: 30 })).toBe(true);
  });

  it("una previsualización sin nada que aplicar sigue bloqueada", () => {
    expect(canApplyPreview({ refereeCount: 0, competitionCount: 0 })).toBe(false);
    expect(canApplyPreview({})).toBe(false);
  });
});
