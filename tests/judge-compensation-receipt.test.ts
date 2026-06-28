import { describe, expect, it } from "vitest";
import {
  buildCompensationReceiptText,
  formatCompetitionDatePhrase,
  formatReceiptAmountEur,
} from "@/lib/judge-compensation/receipt-document";
import { renderCompensationReceiptPdf } from "@/lib/judge-compensation/receipt-pdf";
import { formatIbanDisplay, formatIbanInput, getSpanishIbanValidationHint, isValidSpanishIban, normalizeIban } from "@/lib/judge-compensation/iban";

/** IBAN de prueba (válido MOD-97; no es una cuenta real). */
const SAMPLE_IBAN = "ES9121000418450200051332";
const SAMPLE_IBAN_DISPLAY = "ES91 2100 0418 4502 0005 1332";

describe("formatReceiptAmountEur", () => {
  it("formatea enteros sin decimales", () => {
    expect(formatReceiptAmountEur(60)).toBe("60€");
    expect(formatReceiptAmountEur(185)).toBe("185€");
  });

  it("formatea decimales con coma", () => {
    expect(formatReceiptAmountEur(153.38)).toBe("153,38€");
  });
});

describe("formatCompetitionDatePhrase", () => {
  it("un solo día", () => {
    expect(formatCompetitionDatePhrase("2026-03-22", "2026-03-22")).toBe(
      "el día 22 de marzo de 2026",
    );
  });

  it("dos días consecutivos mismo mes", () => {
    expect(formatCompetitionDatePhrase("2025-11-29", "2025-11-30")).toBe(
      "los días 29 y 30 de noviembre de 2025",
    );
  });

  it("rango dentro del mismo mes", () => {
    expect(formatCompetitionDatePhrase("2025-12-19", "2025-12-21")).toBe(
      "los días 19-21 de diciembre de 2025",
    );
  });
});

describe("IBAN efímero", () => {
  it("normaliza y formatea para el PDF sin persistir", () => {
    expect(normalizeIban(SAMPLE_IBAN_DISPLAY)).toBe(SAMPLE_IBAN);
    expect(formatIbanDisplay(SAMPLE_IBAN)).toBe(SAMPLE_IBAN_DISPLAY);
    expect(isValidSpanishIban(SAMPLE_IBAN_DISPLAY)).toBe(true);
  });

  it("rechaza IBAN inválido", () => {
    expect(isValidSpanishIban("ES00 0000 0000 0000 0000 0000")).toBe(false);
  });

  it("indica caracteres faltantes", () => {
    expect(getSpanishIbanValidationHint("ES00 0000")).toContain("Faltan");
  });

  it("formatea la entrada al escribir", () => {
    expect(formatIbanInput("es9121000418450200051332")).toBe(SAMPLE_IBAN_DISPLAY);
  });
});

describe("buildCompensationReceiptText", () => {
  it("recibo de club (Young Ambition)", () => {
    const text = buildCompensationReceiptText({
      refereeName: "David Muñoz Rey",
      amountEur: 153.38,
      competitionName: "Young Ambition Cup II",
      sede: "Soto de la Marina, Cantabria",
      fecha: "2026-03-22",
      fechaFin: "2026-03-22",
      iban: SAMPLE_IBAN,
      organizer: {
        type: "club",
        clubName: "Young Ambition Cantabria",
        clubEmail: "youngambitioncantabria@gmail.com",
      },
    });
    expect(text).toContain("Young Ambition Cantabria");
    expect(text).toContain("youngambitioncantabria@gmail.com");
    expect(text).toContain("153,38€");
    expect(text).toContain("como juez en la Young Ambition Cup II");
    expect(text).toContain("el día 22 de marzo de 2026");
    expect(text).toContain(`IBAN: ${SAMPLE_IBAN_DISPLAY}`);
    expect(text).not.toMatch(/guardar|almacenar|persist/i);
    expect(text).not.toContain("Desglose");
  });

  it("recibo AEP nacional", () => {
    const text = buildCompensationReceiptText({
      refereeName: "David Muñoz Rey",
      amountEur: 190,
      competitionName: "Campeonato de España MASTER y Regional Noroeste-1",
      sede: "Narón, A Coruña",
      fecha: "2026-04-25",
      fechaFin: "2026-04-26",
      iban: SAMPLE_IBAN,
      organizer: { type: "aep" },
    });
    expect(text).toContain("JuecesAEP@gmail.com");
    expect(text).toContain("TesoreroAEP@gmail.com");
    expect(text).toContain("he recibido, la cantidad de 190€");
    expect(text).toContain("los días 25 y 26 de abril de 2026");
  });

  it("recibo club voluntario sin pagador explícito", () => {
    const text = buildCompensationReceiptText({
      refereeName: "David Muñoz Rey",
      amountEur: 185,
      competitionName: "III Campeonato del SudEste y V Campeonato Black Oni",
      sede: "Las Torres de Cotillas, Murcia",
      fecha: "2025-11-29",
      fechaFin: "2025-11-30",
      iban: SAMPLE_IBAN,
      organizer: {
        type: "club",
        clubName: "Club Myrtea Lifting",
        clubEmail: "myrtealiftingclub@gmail.com",
        affiliation: "asociacion",
        volunteer: true,
        payer: "none",
        title: "simple",
        laborAsJudge: false,
        competitionArticle: "la",
      },
    });
    expect(text).toContain("colaborador deportivo voluntario");
    expect(text).toContain("he recibido la cantidad de 185€");
    expect(text).toContain("por la labor prestada en la III Campeonato");
  });

  it("genera PDF AEP sin sección de desglose", async () => {
    const pdf = await renderCompensationReceiptPdf({
      refereeName: "David Muñoz Rey",
      amountEur: 190,
      competitionName: "Campeonato de España MASTER y Regional Noroeste-1",
      sede: "Narón, A Coruña",
      fecha: "2026-04-25",
      fechaFin: "2026-04-26",
      iban: SAMPLE_IBAN,
      organizer: { type: "aep" },
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(500);
  });
});
