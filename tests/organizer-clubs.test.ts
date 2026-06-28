import { describe, expect, it } from "vitest";
import {
  AEP_CLUBS_REGISTRY,
  KNOWN_ORGANIZER_CLUBS,
  suggestedEmailsForClubName,
} from "@/lib/organizer-clubs";

describe("organizer clubs registry", () => {
  it("loads 180 clubes curados", () => {
    expect(AEP_CLUBS_REGISTRY.count).toBe(180);
    expect(KNOWN_ORGANIZER_CLUBS.length).toBe(180);
  });

  it("no incluye nombres pegados con localidad del PDF", () => {
    const names = KNOWN_ORGANIZER_CLUBS.join("\n");
    expect(names).not.toMatch(/ChipionaPOWER|MarbellaPOWER|BarbastroBARBASTRO|ZaragozaZARAGOZA/i);
  });

  it("sugiere e-mail correcto para clubes conocidos", () => {
    expect(suggestedEmailsForClubName("MYRTEA LIFTING CLUB Murcia")).toEqual([
      "myrtealiftingclub@gmail.com",
    ]);
    expect(suggestedEmailsForClubName("DEPORNIXAR ALMERÍA")).toEqual([
      "dhernandezfer@gmail.com",
    ]);
    expect(suggestedEmailsForClubName("EFFICIENT STRENGTH Almeria")).toEqual([
      "efficientstrengthclub@gmail.com",
    ]);
    expect(suggestedEmailsForClubName("RESTLESS CLUB Cadiz")).toEqual([
      "restlessclubpowerlifting@gmail.com",
    ]);
    expect(suggestedEmailsForClubName("POWERLIFTING MADRID")).toEqual([
      "info@clubpowerliftingmadrid.com",
    ]);
  });
});
