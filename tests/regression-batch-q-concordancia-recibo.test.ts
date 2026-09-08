import { describe, expect, it } from "vitest";
import { buildCompensationReceiptText } from "@/lib/judge-compensation/receipt-document";

const SAMPLE_IBAN = "ES9121000418450200051332";

/** Recibo de club, que es el organizador por defecto en producción. */
function reciboClub(competitionName: string, fecha = "2026-06-14", fechaFin = fecha) {
  return buildCompensationReceiptText({
    refereeName: "David Muñoz Rey",
    amountEur: 120,
    competitionName,
    sede: "Madrid",
    fecha,
    fechaFin,
    iban: SAMPLE_IBAN,
    organizer: {
      type: "club",
      clubName: "Club Ejemplo",
      clubEmail: "club@ejemplo.es",
      volunteer: false,
    },
  });
}

// `competitionArticle` no lo rellena nadie en producción
// (`receiptOrganizerFromCompetition` solo pone tipo, nombre, correo y
// voluntario), así que el artículo del recibo de club era literalmente "la"
// fijo: correcto para las copas y falta de ortografía para todo lo demás.

describe("artículo del recibo de club", () => {
  it("concuerda con el sustantivo aunque vaya al final del nombre", () => {
    // El caso que dejó esto pendiente: la regla anterior solo miraba la primera
    // palabra, así que «Young Ambition Cup» habría dado «el».
    expect(reciboClub("Young Ambition Cup II")).toContain(
      "como juez en la Young Ambition Cup II",
    );
  });

  it("los nombres masculinos dejan de llevar «la»", () => {
    expect(reciboClub("III Campeonato del SudEste")).toContain(
      "como juez en el III Campeonato del SudEste",
    );
    expect(reciboClub("Trofeo de Invierno")).toContain("como juez en el Trofeo de Invierno");
    expect(reciboClub("Open de Madrid")).toContain("como juez en el Open de Madrid");
    expect(reciboClub("Memorial Juan Pérez")).toContain("como juez en el Memorial Juan Pérez");
  });

  it("los femeninos siguen llevando «la»", () => {
    expect(reciboClub("I Copa de Primavera")).toContain("como juez en la I Copa de Primavera");
    expect(reciboClub("Liga Nacional de Powerlifting")).toContain(
      "como juez en la Liga Nacional de Powerlifting",
    );
    expect(reciboClub("Final Autonómica")).toContain("como juez en la Final Autonómica");
  });

  it("un nombre combinado concuerda con el primer sustantivo, que es el que manda", () => {
    expect(reciboClub("Campeonato del SudEste y Copa Black Oni")).toContain(
      "como juez en el Campeonato del SudEste y Copa Black Oni",
    );
    expect(reciboClub("Copa de Otoño y Trofeo Ciudad")).toContain(
      "como juez en la Copa de Otoño y Trofeo Ciudad",
    );
  });

  it("sin sustantivo reconocible usa el masculino, que es la forma no marcada", () => {
    expect(reciboClub("Black Oni 2026")).toContain("como juez en el Black Oni 2026");
  });
});

describe("participio del recibo de club", () => {
  it("concuerda con el sustantivo, no con la duración del campeonato", () => {
    // Antes: un día → «celebrada», varios → «celebrado», mirase lo que mirase
    // el nombre. Acertaba por casualidad cuando las pruebas de un día eran
    // copas, y fallaba en cuanto no lo eran.
    expect(reciboClub("Trofeo de Invierno")).toContain("celebrado en Madrid el día");
    expect(reciboClub("Copa de Primavera")).toContain("celebrada en Madrid el día");
  });

  it("un campeonato de varios días femenino ya no sale como «celebrado»", () => {
    expect(reciboClub("Copa de Primavera", "2026-06-13", "2026-06-14")).toContain(
      "celebrada en Madrid, los días",
    );
  });

  it("artículo y participio siempre coinciden entre sí", () => {
    for (const nombre of ["Copa de Otoño", "Trofeo Ciudad", "Young Ambition Cup", "Open de Madrid"]) {
      const texto = reciboClub(nombre);
      const femenino = texto.includes(`como juez en la ${nombre}`);
      expect(texto.includes("celebrada en"), nombre).toBe(femenino);
    }
  });
});
