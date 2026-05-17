import { describe, expect, it } from "vitest";
import { mapSanction, sanctionToDbRow } from "@/server/db/sanction-mappers";

describe("sanction-mappers", () => {
  it("mapSanction maps DB row to domain", () => {
    const s = mapSanction({
      id: "san-1",
      referee_id: "ref-1",
      referee_name: "Ana López",
      zona: "CENTRO",
      motivo: "Incidencia",
      fecha_inicio: "2026-03-01T00:00:00Z",
      fecha_fin: "2026-03-31",
      status: "activa",
      impuesta_por_nombre: "Admin",
      delegate_notify: {
        delegates: [{ id: "d1", nombre: "Del", email: "del@test.com" }],
        mailtoUrl: "mailto:del@test.com",
      },
    });
    expect(s.id).toBe("san-1");
    expect(s.fechaInicio).toBe("2026-03-01");
    expect(s.delegateNotify.delegates).toHaveLength(1);
    expect(s.delegateNotify.mailtoUrl).toContain("mailto:");
  });

  it("sanctionToDbRow maps domain fields", () => {
    const row = sanctionToDbRow({
      refereeId: "ref-1",
      motivo: "Test",
      fechaInicio: "2026-04-01",
      fechaFin: "2026-04-30",
      status: "activa",
    });
    expect(row.referee_id).toBe("ref-1");
    expect(row.motivo).toBe("Test");
    expect(row.fecha_inicio).toBe("2026-04-01");
  });
});
