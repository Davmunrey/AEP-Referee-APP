import { describe, expect, it } from "vitest";
import {
  KNOWN_ORGANIZER_CLUBS,
  isClubEmailShaped,
  normalizeClubEmails,
  suggestedEmailsForClubName,
} from "@/lib/organizer-clubs";

/**
 * El e-mail de devolución del club va en el recibo de compensación: es el
 * destinatario del documento con el dinero de un juez.
 *
 * La sugerencia caía en la coincidencia PARCIAL, y quien la llama lo hace en
 * cada pulsación de tecla con el campo aún vacío. Al teclear la primera letra
 * del nombre del club, el campo se rellenaba con las direcciones de casi todo
 * el registro; y a partir de ahí ya no estaba vacío, así que no volvía a
 * corregirse.
 */

describe("la sugerencia de e-mails al escribir el club", () => {
  it("una sola letra ya no arrastra medio registro", () => {
    // «A» casa con 173 de los 180 clubes del listado curado.
    for (const inicial of ["A", "C", "E", "P"]) {
      expect(suggestedEmailsForClubName(inicial), inicial).toEqual([]);
    }
  });

  it("un nombre exacto —lo que da elegir del desplegable— sí sugiere", () => {
    const nombre = KNOWN_ORGANIZER_CLUBS[0]!;
    const out = suggestedEmailsForClubName(nombre);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((e) => e.includes("@"))).toBe(true);
  });

  it("un fragmento que solo casa con un club también", () => {
    const nombre = KNOWN_ORGANIZER_CLUBS[0]!;
    const soloUno = KNOWN_ORGANIZER_CLUBS.filter((n) => n.includes(nombre)).length === 1;
    if (soloUno) {
      expect(suggestedEmailsForClubName(nombre).length).toBeGreaterThan(0);
    }
  });

  it("un texto que no casa con nadie no inventa nada", () => {
    expect(suggestedEmailsForClubName("ZZZ CLUB QUE NO EXISTE")).toEqual([]);
    expect(suggestedEmailsForClubName("")).toEqual([]);
  });
});

describe("qué cuenta como dirección", () => {
  it("lo que no tiene forma de e-mail se descarta", () => {
    // El filtro era `includes("@")`: estos tres pasaban y el recibo no llegaba
    // a ninguna parte, sin que nada lo dijera.
    expect(normalizeClubEmails("a@, @b, juan@club")).toEqual([]);
    expect(isClubEmailShaped("juan@club")).toBe(false);
  });

  it("una lista normal se separa, se pasa a minúsculas y se ordena sola", () => {
    expect(normalizeClubEmails("Uno@Club.com; dos@club.es  tres@club.org")).toEqual([
      "uno@club.com",
      "dos@club.es",
      "tres@club.org",
    ]);
  });

  it("no se repite la misma dirección dos veces", () => {
    expect(normalizeClubEmails("uno@club.com, UNO@CLUB.COM")).toEqual(["uno@club.com"]);
  });

  it("un subdominio sigue valiendo", () => {
    expect(isClubEmailShaped("info@correo.club.es")).toBe(true);
  });
});
