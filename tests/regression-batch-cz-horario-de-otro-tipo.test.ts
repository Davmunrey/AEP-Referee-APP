import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El tipo del campeonato decide QUÉ ROLES monta la plantilla de tarima, y al
 * importar un horario el PDF gana sobre lo que dice el campeonato:
 *
 *     const tipo = parsed.header.tipo ?? fileMeta.tipo ?? comp.tipo;
 *
 * Si discrepan —el PDF equivocado, o una cabecera mal leída— la tarima se
 * rehacía con los puestos de otro nivel sin que nada lo dijera: el tipo salía
 * como un dato más entre cinco números de la vista previa, sin compararse con
 * el del campeonato.
 *
 * Y el dinero no lo sigue: los conceptos de la liquidación se calculan con
 * `competition.tipo`, no con el del PDF. O sea, puestos de un nivel cobrados
 * al baremo de otro.
 */

const requireApiUser = vi.fn();
const getRoster = vi.fn();
const saveCompetitionTemplate = vi.fn();
let comp = { id: "evt-1", zona: "CENTRO", tipo: "AEP-2" };

vi.mock("@/lib/api/auth", () => ({
  requireApiUser: () => requireApiUser(),
  isSessionUser: (v: unknown) => !(v instanceof Response),
}));
vi.mock("@/lib/api/roster-mutation-guard", () => ({
  loadCompetitionForRosterWrite: async () => comp,
}));
vi.mock("@/server/services", () => ({
  dataService: {
    getRoster: (...a: unknown[]) => getRoster(...a),
    saveCompetitionTemplate: (...a: unknown[]) => saveCompetitionTemplate(...a),
  },
}));
// La ruta importa del barrel, así que se mockea ahí y se conserva el resto
// —`parsedToRosterTemplate` incluido— con `importOriginal`.
const parseAepHorarioText = vi.fn();
vi.mock("@/lib/schedule-parser", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  validatePdfMime: () => null,
  extractPdfText: async () => ({ text: "irrelevante", pages: 1 }),
  parseScheduleFilename: () => ({}),
  parseAepHorarioText: (...a: unknown[]) => parseAepHorarioText(...a),
}));

const { POST: importar } = await import(
  "@/app/api/v1/competitions/[id]/roster/template/import/route"
);

const ADMIN = {
  id: "u1",
  nombre: "Admin",
  iniciales: "AD",
  email: "a@aep.test",
  rol: "Super Admin",
  role: "super_admin" as const,
};

const ctx = { params: Promise.resolve({ id: "evt-1" }) };

function horario(tipo: string | undefined) {
  return {
    header: { tipo, campeonato: "Campeonato", sede: "Sede" },
    days: [{ raw: "Sábado", short: "Sáb" }],
    sessions: [
      {
        sesion: "S1",
        nombre: "Sesión 1",
        dia: { raw: "Sábado", short: "Sáb" },
        categorias: [{ genero: "Hombres" as const, pesos: "-83" }],
        horarioCompeticion: "10:00 - 13:00",
        horarioPesaje: "08:00 - 09:30",
        grupos: [],
      },
    ],
    warnings: [] as string[],
  };
}

async function subir(): Promise<Response> {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array([1, 2, 3])], "horario.pdf", { type: "application/pdf" }));
  return importar(new Request("http://localhost/x", { method: "POST", body: fd }), ctx);
}

beforeEach(() => {
  vi.clearAllMocks();
  comp = { id: "evt-1", zona: "CENTRO", tipo: "AEP-2" };
  requireApiUser.mockResolvedValue(ADMIN);
  getRoster.mockResolvedValue({ template: [], assignments: {}, flags: {} });
});

describe("importar un horario cuyo tipo no es el del campeonato", () => {
  it("lo avisa, y dice qué se monta y con qué se paga", async () => {
    parseAepHorarioText.mockReturnValue(horario("AEP-1"));
    const res = await subir();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { preview: { warnings: string[]; tipoDetected: string } } };
    expect(body.data.preview.tipoDetected).toBe("AEP-1");
    const aviso = body.data.preview.warnings.join(" ");
    expect(aviso).toContain("AEP-1");
    expect(aviso).toContain("AEP-2");
    expect(aviso).toContain("dietas");
  });

  it("el aviso va el primero, no perdido al final de la lista", async () => {
    const conAvisos = horario("AEP-1");
    conAvisos.warnings = ["Sesión S9 sin categorías"];
    parseAepHorarioText.mockReturnValue(conAvisos);
    const res = await subir();
    const body = (await res.json()) as { data: { preview: { warnings: string[] } } };
    expect(body.data.preview.warnings[0]).toContain("está registrado como AEP-2");
    expect(body.data.preview.warnings).toContain("Sesión S9 sin categorías");
  });
});

describe("cuando coinciden", () => {
  it("no se inventa ningún aviso", async () => {
    parseAepHorarioText.mockReturnValue(horario("AEP-2"));
    const res = await subir();
    const body = (await res.json()) as { data: { preview: { warnings: string[] } } };
    expect(body.data.preview.warnings).toEqual([]);
  });

  it("y un PDF sin tipo en la cabecera hereda el del campeonato, sin aviso", async () => {
    parseAepHorarioText.mockReturnValue(horario(undefined));
    const res = await subir();
    const body = (await res.json()) as { data: { preview: { warnings: string[]; tipoDetected: string } } };
    expect(body.data.preview.tipoDetected).toBe("AEP-2");
    expect(body.data.preview.warnings).toEqual([]);
  });
});
