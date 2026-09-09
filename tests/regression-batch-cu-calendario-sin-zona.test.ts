import { describe, expect, it } from "vitest";
import { normalizeZoneInput } from "@/lib/aep-zones";
import { parseAepCalendarCsv, parseAepCalendarText } from "@/lib/calendar-parser";
import { zonaNoDeducidaWarning } from "@/lib/calendar-parser/entry-warnings";

/**
 * Un campeonato importado del calendario sin zona deducible nace con `zona`
 * nula —`normalizeZoneInput` la convierte en `null`— y entonces NO lo ve
 * ningún delegado de zona: el listado filtra por código de zona y `null` no
 * casa con ninguno. Queda visible solo para super admin, delegado de jueces y
 * financiero.
 *
 * Es decir: el campeonato existe y quien tiene que montarle la tarima no sabe
 * que existe.
 *
 * El lector de CSV avisaba de ello. El de PDF, de nada — y el PDF es el camino
 * habitual, porque es lo que publica la AEP. Ahora avisan los dos con el mismo
 * texto, y el texto dice lo que pasa además de lo que falta.
 */

function pdf(nombre: string, localidad: string): string {
  return [
    "CALENDARIO de COMPETICIONES 2026",
    "",
    "24-25 ene",
    "",
    nombre,
    "",
    localidad,
    "",
    "Club Organizador",
    "",
    "AEP3",
    "",
    "OPEN",
    "",
    "P-B",
    "",
  ].join("\n");
}

// El lector de CSV toma la fecha de la columna 1, el nombre de la 2 y la
// localidad de la 3.
const CSV_SIN_ZONA = [
  "Nº,Fecha,Competición,Localidad,Organizador,Nivel,Divisiones,Modalidades",
  "1,17-ene-26,Trofeo Sin Sede,Villa Inventada,Club Organizador,AEP3,OPEN,P-B",
].join("\n");

describe("una entrada de calendario cuya zona no se puede deducir", () => {
  const sinZona = parseAepCalendarText(pdf("Trofeo Sin Sede", "Villa Inventada"));

  it("el PDF la deja sin zona", () => {
    const entrada = sinZona.entries.find((e) => e.esEspaña);
    expect(entrada?.tipo).toBe("AEP-3");
    expect(entrada?.zona).toBeUndefined();
  });

  it("y ahora avisa, que antes no decía nada", () => {
    expect(sinZona.warnings).toContain(
      zonaNoDeducidaWarning("Trofeo Sin Sede", "Villa Inventada"),
    );
  });

  it("el aviso dice la consecuencia, no solo lo que falta", () => {
    const aviso = sinZona.warnings.find((w) => w.startsWith("Zona no deducida"));
    expect(aviso).toContain("no lo verá ningún delegado de zona");
  });

  it("y esa es de verdad la consecuencia: sin zona se guarda null", () => {
    expect(normalizeZoneInput(undefined)).toBeNull();
    expect(normalizeZoneInput("Villa Inventada")).toBeNull();
  });

  it("el CSV usa el mismo texto, para que no vuelvan a divergir", () => {
    const desdeCsv = parseAepCalendarCsv(CSV_SIN_ZONA);
    const entrada = desdeCsv.entries.find((e) => e.esEspaña);
    expect(entrada?.zona).toBeUndefined();
    expect(desdeCsv.warnings).toContain(
      zonaNoDeducidaWarning("Trofeo Sin Sede", "Villa Inventada"),
    );
  });
});

describe("una entrada cuya zona sí se deduce", () => {
  it("no genera el aviso", () => {
    const parsed = parseAepCalendarText(pdf("Trofeo de Prueba", "Madrid (Madrid)"));
    const entrada = parsed.entries.find((e) => e.esEspaña);
    expect(entrada?.zona).toBe("CENTRO");
    expect(normalizeZoneInput(entrada?.zona)).toBe("CENTRO");
    expect(parsed.warnings.join(" ")).not.toContain("Zona no deducida");
  });
});
