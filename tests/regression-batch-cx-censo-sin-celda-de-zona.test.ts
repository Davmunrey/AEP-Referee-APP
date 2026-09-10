import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseJudgesRegistryXlsx } from "@/lib/judges-registry";

/**
 * `mapExcelZone` acepta zona, localidad y provincia, y solo deduce por
 * localidad cuando la celda «Zona» está VACÍA: una zona escrita pero no
 * reconocida sigue mandando, que es la regla «el Excel manda».
 *
 * La hoja de campeonatos la llamaba con los tres argumentos. La de jueces,
 * solo con el primero. Así que un juez con la celda «Zona» en blanco se
 * descartaba del censo aunque su localidad estuviera en la columna de al
 * lado —el propio aviso la imprimía, como si se hubiera mirado—.
 *
 * Y en «reemplazar el censo» eso no es solo no importarlo: al no estar en la
 * lista de jueces del Excel, ese juez entra en la lista de borrables.
 */

/** Columnas de la hoja «Datos»: 0=ID, 1=Nombre, 2=Nivel, 4=Zona, 5=Localidad, 7=Activo. */
function fila(
  id: number,
  nombre: string,
  zona: string | null,
  localidad: string | null,
): unknown[] {
  const row: unknown[] = Array(13).fill(null);
  row[0] = id;
  row[1] = nombre;
  row[2] = "Nacional";
  row[4] = zona;
  row[5] = localidad;
  row[7] = true;
  return row;
}

function excel(filas: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const header = Array(13).fill("");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...filas]), "Datos");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("un juez con la celda «Zona» en blanco", () => {
  it("se importa deduciendo la zona de su localidad", () => {
    const parsed = parseJudgesRegistryXlsx(excel([fila(1, "Juez Sin Celda", null, "Madrid")]));
    expect(parsed.referees).toHaveLength(1);
    expect(parsed.referees[0]).toMatchObject({
      excelId: 1,
      nombre: "Juez Sin Celda",
      zona: "CENTRO",
    });
    expect(parsed.warnings.join(" ")).not.toContain("zona no reconocida");
  });

  it("y con la localidad entre paréntesis también", () => {
    const parsed = parseJudgesRegistryXlsx(
      excel([fila(2, "Juez Con Provincia", "", "Arganda del Rey (Madrid)")]),
    );
    expect(parsed.referees[0]?.zona).toBe("CENTRO");
  });
});

describe("lo que no cambia", () => {
  it("una zona escrita y reconocida sigue mandando sobre la localidad", () => {
    const parsed = parseJudgesRegistryXlsx(
      excel([fila(3, "Juez De Otra Zona", "1- NOROESTE", "Madrid")]),
    );
    expect(parsed.referees[0]?.zona).toBe("NOROESTE");
  });

  it("una zona escrita pero NO reconocida no se deduce: el Excel manda", () => {
    const parsed = parseJudgesRegistryXlsx(
      excel([fila(4, "Juez Zona Rara", "Levante", "Madrid")]),
    );
    expect(parsed.referees).toHaveLength(0);
    expect(parsed.warnings.join(" ")).toContain("zona no reconocida");
  });

  it("sin zona y sin localidad utilizable sigue quedando fuera, y el aviso lo dice", () => {
    const parsed = parseJudgesRegistryXlsx(
      excel([fila(5, "Juez Sin Nada", null, "Villa Inventada")]),
    );
    expect(parsed.referees).toHaveLength(0);
    const aviso = parsed.warnings.find((w) => w.includes("Juez Sin Nada"));
    expect(aviso).toContain("no deducible");
    expect(aviso).toContain("quedará fuera");
  });
});
