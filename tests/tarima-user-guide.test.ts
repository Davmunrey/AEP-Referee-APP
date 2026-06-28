import { describe, expect, it } from "vitest";
import { renderTarimaUserGuidePdf } from "@/lib/guides/render-tarima-user-guide-pdf";
import { tarimaUserGuideFilename } from "@/lib/guides/tarima-user-guide-filename";
import { buildTarimaUserGuideSections } from "@/lib/guides/tarima-user-guide-content";
import { KNOWN_ORGANIZER_CLUBS, suggestedEmailsForClubName } from "@/lib/organizer-clubs";

describe("tarima user guide pdf", () => {
  it("builds all guide sections", () => {
    const sections = buildTarimaUserGuideSections("https://example.test");
    expect(sections.length).toBeGreaterThanOrEqual(10);
    expect(sections[0]?.steps.length).toBeGreaterThan(0);
  });

  it("documents compensation with km manual and montaje sistema", () => {
    const sections = buildTarimaUserGuideSections("https://example.test");
    const compensation = sections.find((s) => s.title.includes("COMPENSACIÓN"));
    expect(compensation?.steps.some((s) => s.id === "6.3" && s.title.includes("Kilometraje manual"))).toBe(true);
    expect(compensation?.steps.some((s) => s.id === "6.5" && s.title.includes("Montaje del sistema"))).toBe(true);
    expect(compensation?.intro).not.toContain("OpenStreetMap");
  });

  it("renders a non-empty PDF buffer", async () => {
    const pdf = await renderTarimaUserGuidePdf("https://example.test");
    expect(pdf.length).toBeGreaterThan(5000);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("uses stable filename", () => {
    expect(tarimaUserGuideFilename()).toContain("Manual-AEP-Tarima");
  });
});

describe("aep clubs registry", () => {
  it("loads official club list", () => {
    expect(KNOWN_ORGANIZER_CLUBS.length).toBeGreaterThan(150);
  });

  it("suggests email for known club", () => {
    const emails = suggestedEmailsForClubName("MYRTEA LIFTING CLUB Murcia");
    expect(emails).toContain("myrtealiftingclub@gmail.com");
  });
});
