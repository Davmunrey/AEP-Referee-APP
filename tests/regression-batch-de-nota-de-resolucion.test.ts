import { beforeEach, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/types";
import { __resetTicketsStore, ticketService } from "@/server/services/memory-tickets";

/**
 * Resolver un ticket SIN nota borra la nota anterior.
 *
 * El backend de producción lo escribe siempre explícito
 * (`resolution_note = resolutionNote ?? null`) y dice por qué: si el ticket se
 * reabrió y se vuelve a resolver sin nota, dejarla intacta resucita la nota de
 * la resolución anterior como si fuera la de ahora. Y no hace falta reabrirlo:
 * la pantalla trae el recuadro relleno con la nota anterior, así que vaciarlo
 * a propósito es un gesto normal — la ruta manda entonces `undefined`.
 *
 * El gemelo en memoria —el backend con el que se desarrolla— se había quedado
 * con `if (resolutionNote !== undefined)`, así que ahí la nota vieja
 * sobrevivía y las dos implementaciones contaban historias distintas del mismo
 * ticket.
 */

const AUTOR: SessionUser = {
  id: "u-1",
  email: "juez@aep.test",
  nombre: "Ana Ruiz",
  rol: "Solo Ver",
  iniciales: "AR",
  role: "solo_ver",
};

const ADMIN: SessionUser = {
  id: "u-2",
  email: "admin@aep.test",
  nombre: "Delegado de Jueces",
  rol: "Delegado de Jueces",
  iniciales: "DJ",
  role: "delegado_jueces",
};

async function ticketResuelto(nota?: string) {
  const creado = await ticketService.createTicket({
    user: AUTOR,
    titulo: "No puedo entrar",
    descripcion: "La pantalla se queda en blanco al iniciar sesión.",
    categoria: "incidencia",
  });
  await ticketService.updateTicketStatus({
    user: ADMIN,
    ticketId: creado.id,
    status: "resuelto",
    resolutionNote: "Era la caché del navegador.",
  });
  return ticketService.updateTicketStatus({
    user: ADMIN,
    ticketId: creado.id,
    status: "resuelto",
    resolutionNote: nota,
  });
}

beforeEach(() => {
  __resetTicketsStore();
});

describe("volver a resolver un ticket", () => {
  it("sin nota, no resucita la de la resolución anterior", async () => {
    const ticket = await ticketResuelto(undefined);
    expect(ticket?.resolutionNote).toBeUndefined();
  });

  it("con nota nueva, se queda la nueva", async () => {
    const ticket = await ticketResuelto("En realidad era un fallo del inicio de sesión.");
    expect(ticket?.resolutionNote).toBe("En realidad era un fallo del inicio de sesión.");
  });

  it("y quien resolvió y cuándo se actualizan igualmente", async () => {
    const ticket = await ticketResuelto(undefined);
    expect(ticket?.resolvedBy).toBe("Delegado de Jueces");
    expect(ticket?.resolvedAt).toBeTruthy();
    expect(ticket?.status).toBe("resuelto");
  });
});

describe("cerrar un ticket ya resuelto", () => {
  it("no toca la nota de resolución", async () => {
    const resuelto = await ticketResuelto("Era la caché.");
    const cerrado = await ticketService.updateTicketStatus({
      user: ADMIN,
      ticketId: resuelto!.id,
      status: "cerrado",
    });
    expect(cerrado?.status).toBe("cerrado");
    expect(cerrado?.resolutionNote).toBe("Era la caché.");
  });
});
