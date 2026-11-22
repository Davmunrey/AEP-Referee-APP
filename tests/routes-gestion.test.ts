import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { SessionUser } from "@/lib/types";
import { campeonato, ctx, cuerpo, get, peticion, sinSesion, usuarios } from "./helpers/route-harness";

// Rutas de gestión sin test hasta ahora: tickets, sanciones, campeonato,
// compensación, disponibilidad, duplicados y las lecturas de arranque.

const { auth, ds, sanciones, geo, exportaciones } = vi.hoisted(() => {
  type Store = Record<string, Mock<(...a: unknown[]) => Promise<unknown>>>;
  return {
    auth: { user: null as unknown },
    ds: {} as Store,
    sanciones: {} as Store,
    geo: {} as Store,
    exportaciones: (store: Store, nombres: string[]) =>
      Object.fromEntries(
        nombres.map((n) => [n, (...a: unknown[]) => (store[n] ??= vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => undefined))(...a)]),
      ),
  };
});

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: async () => auth.user,
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/server/services", () => ({
  dataService: new Proxy({}, { get: (_t, k: string) => (ds[k] ??= vi.fn(async () => undefined)) }),
}));
vi.mock("@/server/services/referee-sanctions", () => exportaciones(sanciones, ["getRefereeSanction"]));
vi.mock("@/lib/geocoding/photon-search", () => exportaciones(geo, ["searchPhotonAddresses"]));
vi.mock("@/lib/judge-compensation/osm-distance", async (orig) => ({
  ...(await orig<object>()),
  geocodeAddress: (...a: unknown[]) => (geo.geocodeAddress ??= vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({ lat: 40, lng: -3 })))(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const fn = (store: Record<string, Mock<(...a: unknown[]) => Promise<unknown>>>, name: string) =>
  (store[name] ??= vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => undefined));
const como = (u: SessionUser | Response) => {
  auth.user = u;
};

import { GET as listTickets, POST as newTicket } from "@/app/api/v1/tickets/route";
import { GET as getTicket, PATCH as patchTicket } from "@/app/api/v1/tickets/[id]/route";
import { POST as commentTicket } from "@/app/api/v1/tickets/[id]/comments/route";
import { PATCH as revokeSanction } from "@/app/api/v1/sanctions/[id]/route";
import { POST as notifySanction } from "@/app/api/v1/sanctions/[id]/notify/route";
import {
  GET as getComp,
  PATCH as patchComp,
  DELETE as deleteComp,
} from "@/app/api/v1/competitions/[id]/route";
import { GET as hub } from "@/app/api/v1/compensation/hub/route";
import { POST as distances } from "@/app/api/v1/competitions/[id]/compensation/distances/route";
import { POST as recalculate } from "@/app/api/v1/competitions/[id]/compensation/recalculate/route";
import { POST as exportReceipt } from "@/app/api/v1/competitions/[id]/compensation/[refereeId]/export/route";
import { GET as getAvail, POST as addAvail } from "@/app/api/v1/competitions/[id]/availability/route";
import { DELETE as delAvail } from "@/app/api/v1/competitions/[id]/availability/[refereeId]/route";
import { GET as dedupeGet, POST as dedupePost } from "@/app/api/v1/competitions/dedupe/route";
import { GET as approvals } from "@/app/api/v1/approvals/route";
import { GET as dashboard } from "@/app/api/v1/dashboard/route";
import { GET as meta } from "@/app/api/v1/meta/route";
import { GET as me } from "@/app/api/v1/auth/me/route";
import { GET as regulations } from "@/app/api/v1/regulations/route";
import { GET as geocode } from "@/app/api/v1/geocode/search/route";
import { CompetitionHasClaimsError } from "@/lib/competitions/service-types";

const c1 = ctx({ id: "c1" });

const multipart = (campos: Record<string, string>, ficheros: File[] = []) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  for (const f of ficheros) fd.append("files", f);
  return new Request("http://localhost/api", { method: "POST", body: fd });
};
const png = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], "foto.png", {
    type: "image/png",
  });

beforeEach(() => {
  for (const s of [ds, sanciones, geo]) for (const k of Object.keys(s)) delete s[k];
  vi.spyOn(console, "error").mockImplementation(() => {});
  como(usuarios.admin);
  fn(ds, "getCompetition").mockResolvedValue(campeonato());
});

describe("lecturas de arranque", () => {
  const lecturas: [string, () => Promise<Response>, string][] = [
    ["aprobaciones", () => approvals(), "getApprovals"],
    ["panel", () => dashboard(), "getDashboard"],
    ["meta", () => meta(), "getMeta"],
    ["auth/me", () => me(), "getMeta"],
    ["normativa", () => regulations(), "getRegulations"],
  ];

  it.each(lecturas)("%s: sin sesión, 401", async (_n, call, servicio) => {
    como(sinSesion());
    expect((await call()).status).toBe(401);
    expect(fn(ds, servicio)).not.toHaveBeenCalled();
  });

  it.each(lecturas)("%s: si la base falla, error con cuerpo JSON", async (_n, call, servicio) => {
    fn(ds, servicio).mockRejectedValue(new Error("caída"));
    const res = await call();
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect((await cuerpo(res)).error).toBeTruthy();
  });

  it("panel, aprobaciones y meta reciben la sesión para filtrar por rol y zona", async () => {
    como(usuarios.zona);
    for (const [, call, servicio] of lecturas.slice(0, 3)) {
      fn(ds, servicio).mockResolvedValue({});
      expect((await call()).status).toBe(200);
      expect(fn(ds, servicio)).toHaveBeenCalledWith(usuarios.zona);
    }
  });
});

describe("tickets", () => {
  it("un filtro de estado inventado es 400", async () => {
    expect((await listTickets(get("http://localhost/api?status=raro"))).status).toBe(400);
  });

  it("la lista se pide con la sesión (cada uno ve lo suyo salvo administración)", async () => {
    fn(ds, "getTickets").mockResolvedValue([]);
    como(usuarios.lectura);
    await listTickets(get("http://localhost/api?status=abierto"));
    expect(fn(ds, "getTickets")).toHaveBeenCalledWith({ user: usuarios.lectura, status: "abierto" });
  });

  it("crear valida título, descripción, categoría y que los adjuntos sean imágenes", async () => {
    expect((await newTicket(peticion({ titulo: "x" }))).status).toBe(400);
    expect((await newTicket(multipart({ titulo: "a", descripcion: "Algo", categoria: "incidencia" }))).status).toBe(400);
    const valido = { titulo: "No carga la tarima", descripcion: "Al abrir la tarima sale un error.", categoria: "incidencia" };
    expect((await newTicket(multipart({ ...valido, categoria: "inventada" }))).status).toBe(400);
    const falso = new File(["<script>"], "foto.png", { type: "image/png" });
    expect((await newTicket(multipart(valido, [falso]))).status).toBe(400);
    expect(fn(ds, "createTicket")).not.toHaveBeenCalled();
  });

  it("crea el ticket con su adjunto", async () => {
    fn(ds, "createTicket").mockResolvedValue({ id: "t1" });
    const res = await newTicket(
      multipart({ titulo: "No carga la tarima", descripcion: "Al abrir la tarima sale un error.", categoria: "incidencia" }, [png()]),
    );
    expect(res.status).toBe(200);
    const arg = fn(ds, "createTicket").mock.calls[0]?.[0] as { files: { contentType: string }[]; user: SessionUser };
    expect(arg.user).toBe(usuarios.admin);
    expect(arg.files[0]?.contentType).toBe("image/png");
  });

  it("ticket ajeno o inexistente es 404", async () => {
    fn(ds, "getTicket").mockResolvedValue(null);
    expect((await getTicket(get(), ctx({ id: "t9" }))).status).toBe(404);
  });

  it("quien no administra tickets solo puede cerrarlos", async () => {
    como(usuarios.lectura);
    expect((await patchTicket(peticion({ status: "resuelto" }, "PATCH"), ctx({ id: "t1" }))).status).toBe(403);
    fn(ds, "updateTicketStatus").mockResolvedValue({ id: "t1" });
    expect((await patchTicket(peticion({ status: "cerrado" }, "PATCH"), ctx({ id: "t1" }))).status).toBe(200);
  });

  it("estado inválido o nota de resolución desmesurada, 400", async () => {
    expect((await patchTicket(peticion({}, "PATCH"), ctx({ id: "t1" }))).status).toBe(400);
    expect((await patchTicket(peticion({ status: "x" }, "PATCH"), ctx({ id: "t1" }))).status).toBe(400);
    expect(
      (await patchTicket(peticion({ status: "resuelto", resolutionNote: "x".repeat(5001) }, "PATCH"), ctx({ id: "t1" })))
        .status,
    ).toBe(400);
  });

  it("comentar exige texto y llega al servicio en nombre de quien comenta", async () => {
    expect((await commentTicket(multipart({ body: "" }), ctx({ id: "t1" }))).status).toBe(400);
    fn(ds, "addTicketComment").mockResolvedValue({ id: "t1" });
    expect((await commentTicket(multipart({ body: "Sigue pasando" }), ctx({ id: "t1" }))).status).toBe(200);
    expect(fn(ds, "addTicketComment")).toHaveBeenCalledWith(
      expect.objectContaining({ user: usuarios.admin, ticketId: "t1", body: "Sigue pasando" }),
    );
  });
});

describe("sanciones", () => {
  const sancion = { id: "s1", zona: "CENTRO" };

  it("solo lectura no puede ni revocar ni marcar aviso", async () => {
    como(usuarios.lectura);
    expect((await revokeSanction(peticion({ action: "revoke" }, "PATCH"), ctx({ id: "s1" }))).status).toBe(403);
    expect((await notifySanction(peticion(), ctx({ id: "s1" }))).status).toBe(403);
  });

  it("un delegado de otra zona tampoco", async () => {
    como(usuarios.otraZona);
    fn(sanciones, "getRefereeSanction").mockResolvedValue(sancion);
    expect((await revokeSanction(peticion({ action: "revoke", motivo: "x" }, "PATCH"), ctx({ id: "s1" }))).status).toBe(403);
    expect((await notifySanction(peticion(), ctx({ id: "s1" }))).status).toBe(403);
    expect(fn(ds, "revokeRefereeSanction")).not.toHaveBeenCalled();
  });

  it("acción desconocida 400; sanción inexistente 404", async () => {
    expect((await revokeSanction(peticion({ action: "borrar" }, "PATCH"), ctx({ id: "s1" }))).status).toBe(400);
    fn(sanciones, "getRefereeSanction").mockResolvedValue(null);
    expect((await revokeSanction(peticion({ action: "revoke" }, "PATCH"), ctx({ id: "s9" }))).status).toBe(404);
  });

  it("su delegado de zona revoca con motivo", async () => {
    como(usuarios.zona);
    fn(sanciones, "getRefereeSanction").mockResolvedValue(sancion);
    fn(ds, "revokeRefereeSanction").mockResolvedValue({ id: "s1" });
    const res = await revokeSanction(peticion({ action: "revoke", motivo: "Error de registro" }, "PATCH"), ctx({ id: "s1" }));
    expect(res.status).toBe(200);
    expect(fn(ds, "revokeRefereeSanction")).toHaveBeenCalledWith("s1", usuarios.zona, "Error de registro");
  });
});

describe("campeonato", () => {
  it("un delegado de otra zona no lo ve, ni lo edita, ni lo borra", async () => {
    como(usuarios.otraZona);
    expect((await getComp(get(), c1)).status).toBe(403);
    expect((await patchComp(peticion({ nombre: "Otro" }, "PATCH"), c1)).status).toBe(403);
    expect((await deleteComp(peticion(undefined, "DELETE"), c1)).status).toBe(403);
    expect(fn(ds, "updateCompetition")).not.toHaveBeenCalled();
    expect(fn(ds, "deleteCompetition")).not.toHaveBeenCalled();
  });

  it("el financiero solo cambia lo de la compensación, aunque mande más", async () => {
    como(usuarios.financiero);
    fn(ds, "updateCompetition").mockResolvedValue(campeonato());
    const res = await patchComp(
      peticion({ nombre: "Renombrado", aprobacion: "Aprobado", compensationClubName: "Club Uno", compensationVolunteer: true }, "PATCH"),
      c1,
    );
    expect(res.status).toBe(200);
    const patch = fn(ds, "updateCompetition").mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch).toEqual({ compensationClubName: "Club Uno", compensationVolunteer: true });
  });

  it("nunca deja tocar el estado de aprobación desde aquí", async () => {
    fn(ds, "updateCompetition").mockResolvedValue(campeonato());
    await patchComp(peticion({ nombre: "Copa", aprobacion: "Aprobado", estado: "x", confirmados: 9 }, "PATCH"), c1);
    const patch = fn(ds, "updateCompetition").mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch).not.toHaveProperty("aprobacion");
    expect(patch).not.toHaveProperty("estado");
    expect(patch).not.toHaveProperty("confirmados");
  });

  it("un delegado no puede mover el campeonato a otra zona", async () => {
    como(usuarios.zona);
    expect((await patchComp(peticion({ zona: "NOROESTE" }, "PATCH"), c1)).status).toBe(403);
  });

  it("demasiados clubes organizadores, 400", async () => {
    const clubs = Array.from({ length: 21 }, (_, i) => ({ name: `Club ${i}`, emails: "" }));
    expect((await patchComp(peticion({ compensationClubs: clubs }, "PATCH"), c1)).status).toBe(400);
  });

  it("una sede sin coordenadas se geolocaliza; si falla, 422", async () => {
    fn(ds, "updateCompetition").mockResolvedValue(campeonato());
    await patchComp(peticion({ sedeDireccion: "Calle Mayor 1, Madrid" }, "PATCH"), c1);
    expect(fn(ds, "updateCompetition").mock.calls[0]?.[1]).toMatchObject({ sedeLat: 40, sedeLng: -3 });
    fn(geo, "geocodeAddress").mockRejectedValueOnce(new Error("sin resultados"));
    expect((await patchComp(peticion({ sedeDireccion: "Nada" }, "PATCH"), c1)).status).toBe(422);
  });

  it("borrar con liquidaciones es 409; bien, revalida y confirma", async () => {
    fn(ds, "deleteCompetition").mockRejectedValueOnce(new CompetitionHasClaimsError(2));
    expect((await deleteComp(peticion(undefined, "DELETE"), c1)).status).toBe(409);
    fn(ds, "deleteCompetition").mockResolvedValueOnce(true);
    expect((await deleteComp(peticion(undefined, "DELETE"), c1)).status).toBe(200);
  });
});

describe("compensación", () => {
  it("solo super admin y financiero", async () => {
    for (const u of [usuarios.nacional, usuarios.zona, usuarios.lectura]) {
      como(u);
      expect((await hub()).status).toBe(403);
      expect((await distances(peticion(), c1)).status).toBe(403);
      expect((await recalculate(peticion(), c1)).status).toBe(403);
      expect((await exportReceipt(peticion({ iban: "ES9121000418450200051332" }), ctx({ id: "c1", refereeId: "j1" }))).status).toBe(403);
    }
    expect(fn(ds, "getCompensationHub")).not.toHaveBeenCalled();
  });

  it("distancias y recálculo de un campeonato inexistente, 404", async () => {
    como(usuarios.financiero);
    fn(ds, "getCompetition").mockResolvedValue(undefined);
    expect((await distances(peticion(), c1)).status).toBe(404);
    expect((await recalculate(peticion(), c1)).status).toBe(404);
  });

  it("el recibo exige un IBAN español válido y no lo guarda", async () => {
    como(usuarios.financiero);
    const rc = ctx({ id: "c1", refereeId: "j1" });
    expect((await exportReceipt(peticion({}), rc)).status).toBe(400);
    expect((await exportReceipt(peticion({ iban: "ES00 0000 0000 0000 0000 0000" }), rc)).status).toBe(400);
    expect(fn(ds, "getCompensationClaimForExport")).not.toHaveBeenCalled();
  });

  it("el recibo de un juez sin km completos no se genera", async () => {
    como(usuarios.financiero);
    fn(ds, "getCompetition").mockResolvedValue(campeonato({ compensationOrganizer: "aep" }));
    fn(ds, "getReferee").mockResolvedValue({ id: "j1", nombre: "Ana Roa" });
    fn(ds, "getCompensationClaimForExport").mockResolvedValue({ financialComplete: false, totalAmount: 50 });
    const res = await exportReceipt(peticion({ iban: "ES9121000418450200051332" }), ctx({ id: "c1", refereeId: "j1" }));
    expect(res.status).toBe(422);
  });
});

describe("disponibilidad confirmada", () => {
  it("leerla respeta la zona", async () => {
    como(usuarios.otraZona);
    expect((await getAvail(get(), c1)).status).toBe(403);
    como(usuarios.zona);
    fn(ds, "getCompetitionAvailability").mockResolvedValue(["j1"]);
    const res = await getAvail(get(), c1);
    expect((await cuerpo<{ confirmedIds: string[] }>(res)).data?.confirmedIds).toEqual(["j1"]);
  });

  it("añadir y quitar: solo quien edita la tarima de esa zona", async () => {
    for (const u of [usuarios.lectura, usuarios.otraZona]) {
      como(u);
      expect((await addAvail(peticion({ refereeId: "j1" }), c1)).status).toBe(403);
      expect((await delAvail(peticion(undefined, "DELETE"), ctx({ id: "c1", refereeId: "j1" }))).status).toBe(403);
    }
    expect(fn(ds, "addCompetitionAvailability")).not.toHaveBeenCalled();
    expect(fn(ds, "removeCompetitionAvailability")).not.toHaveBeenCalled();
  });

  it("añadir valida el cuerpo y que el juez exista", async () => {
    expect((await addAvail(peticion({}), c1)).status).toBe(400);
    fn(ds, "getReferee").mockResolvedValue(undefined);
    expect((await addAvail(peticion({ refereeId: "nadie" }), c1)).status).toBe(404);
    fn(ds, "getReferee").mockResolvedValue({ id: "j1" });
    expect((await addAvail(peticion({ refereeId: "j1" }), c1)).status).toBe(200);
    expect(fn(ds, "addCompetitionAvailability")).toHaveBeenCalledWith("c1", "j1", usuarios.admin.nombre);
  });
});

describe("duplicados de campeonatos", () => {
  it("solo lectura no puede ni buscarlos", async () => {
    como(usuarios.lectura);
    expect((await dedupeGet()).status).toBe(403);
    expect((await dedupePost()).status).toBe(403);
  });

  it("un delegado de zona busca pero no limpia", async () => {
    como(usuarios.zona);
    fn(ds, "findCompetitionDuplicates").mockResolvedValue([
      { key: "k", competitions: [campeonato(), campeonato({ id: "c2" })] },
    ]);
    const res = await dedupeGet();
    expect((await cuerpo<{ duplicateCount: number }>(res)).data?.duplicateCount).toBe(1);
    expect((await dedupePost()).status).toBe(403);
    expect(fn(ds, "removeDuplicateCompetitions")).not.toHaveBeenCalled();
  });

  it("la gestión nacional limpia", async () => {
    como(usuarios.nacional);
    fn(ds, "removeDuplicateCompetitions").mockResolvedValue({ removed: 1 });
    expect((await dedupePost()).status).toBe(200);
  });
});

describe("búsqueda de direcciones", () => {
  it("menos de 3 letras no consulta fuera; más de 200, 400", async () => {
    const res = await geocode(get("http://localhost/api?q=ab"));
    expect((await cuerpo<{ suggestions: unknown[] }>(res)).data?.suggestions).toEqual([]);
    expect(fn(geo, "searchPhotonAddresses")).not.toHaveBeenCalled();
    expect((await geocode(get(`http://localhost/api?q=${"a".repeat(201)}`))).status).toBe(400);
  });

  it("si el servicio externo falla, 502", async () => {
    fn(geo, "searchPhotonAddresses").mockRejectedValue(new Error("caído"));
    expect((await geocode(get("http://localhost/api?q=Calle Mayor"))).status).toBe(502);
  });
});
