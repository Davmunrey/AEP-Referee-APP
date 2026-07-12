import type { RoleKey, RosterRole } from "@/lib/types";

export type SlotCellRef = {
  role: RosterRole;
  slotIndex: number;
};

export type SlotLayoutRow = {
  label?: string;
  cells: (SlotCellRef | null)[];
};

function slotKey(roleKey: RoleKey, index: number): string {
  return `${roleKey}_${index}`;
}

function findRole(roles: RosterRole[], key: RoleKey): RosterRole | undefined {
  return roles.find((r) => r.key === key);
}

function cellRef(role: RosterRole, slotIndex: number): SlotCellRef {
  return { role, slotIndex };
}

function takeFirstUnplaced(
  role: RosterRole | undefined,
  placed: Set<string>,
): SlotCellRef | null {
  if (!role) return null;
  for (let i = 0; i < role.slots; i++) {
    const key = slotKey(role.key, i);
    if (!placed.has(key)) {
      placed.add(key);
      return cellRef(role, i);
    }
  }
  return null;
}

function takeFromKeys(
  roles: RosterRole[],
  keys: RoleKey[],
  placed: Set<string>,
): SlotCellRef | null {
  for (const key of keys) {
    const ref = takeFirstUnplaced(findRole(roles, key), placed);
    if (ref) return ref;
  }
  return null;
}

function padRow(cells: (SlotCellRef | null)[]): SlotLayoutRow["cells"] {
  const row: (SlotCellRef | null)[] = [...cells];
  while (row.length < 3) row.push(null);
  return row.slice(0, 3);
}

function buildTarimaRow(roles: RosterRole[], placed: Set<string>): SlotLayoutRow | null {
  const central = findRole(roles, "central");
  const lateral = findRole(roles, "lateral");
  if (!central && !lateral) return null;

  const cells: (SlotCellRef | null)[] = [];

  if (central && central.slots > 0) {
    placed.add(slotKey("central", 0));
    cells.push(cellRef(central, 0));
  } else {
    cells.push(null);
  }

  for (let i = 0; i < 2; i++) {
    if (lateral && i < lateral.slots) {
      placed.add(slotKey("lateral", i));
      cells.push(cellRef(lateral, i));
    } else {
      cells.push(null);
    }
  }

  return { cells: padRow(cells) };
}

function buildMesaRow(roles: RosterRole[], placed: Set<string>): SlotLayoutRow | null {
  const col1 = takeFromKeys(roles, ["liftingcast", "ordenador"], placed);
  const col2 = takeFromKeys(roles, ["control"], placed);
  const col3 = takeFromKeys(roles, ["mesa", "speaker"], placed);
  if (!col1 && !col2 && !col3) return null;
  return { cells: padRow([col1, col2, col3]) };
}

function buildJuradoRow(roles: RosterRole[], placed: Set<string>): SlotLayoutRow | null {
  const jurado = findRole(roles, "jurado");
  if (!jurado) return null;

  const cells: (SlotCellRef | null)[] = [];
  for (let i = 0; i < 3; i++) {
    if (i < jurado.slots) {
      placed.add(slotKey("jurado", i));
      cells.push(cellRef(jurado, i));
    } else {
      cells.push(null);
    }
  }
  return { label: "Jurado", cells: padRow(cells) };
}

function buildRemainderRows(roles: RosterRole[], placed: Set<string>): SlotLayoutRow[] {
  const remaining: SlotCellRef[] = [];
  for (const role of roles) {
    for (let i = 0; i < role.slots; i++) {
      const key = slotKey(role.key, i);
      if (!placed.has(key)) {
        placed.add(key);
        remaining.push(cellRef(role, i));
      }
    }
  }

  const rows: SlotLayoutRow[] = [];
  for (let i = 0; i < remaining.length; i += 3) {
    const chunk: (SlotCellRef | null)[] = remaining.slice(i, i + 3);
    rows.push({ cells: padRow(chunk) });
  }
  return rows;
}

/** Cuadrante competición: tarima 3 cols, mesa 3 cols, jurado 3 cols, resto en filas de 3. */
export function buildCompetitionSlotLayout(roles: RosterRole[]): SlotLayoutRow[] {
  const placed = new Set<string>();
  const rows: SlotLayoutRow[] = [];

  const tarima = buildTarimaRow(roles, placed);
  if (tarima) rows.push(tarima);

  const mesa = buildMesaRow(roles, placed);
  if (mesa) rows.push(mesa);

  const jurado = buildJuradoRow(roles, placed);
  if (jurado) rows.push(jurado);

  rows.push(...buildRemainderRows(roles, placed));
  return rows;
}

/** Pesaje: hasta 3 columnas (pesaje, equipamiento, material). */
export function buildPesajeSlotLayout(roles: RosterRole[]): SlotLayoutRow[] {
  const placed = new Set<string>();
  const col1 = takeFromKeys(roles, ["pesaje"], placed);
  const col2 = takeFromKeys(roles, ["equipamiento"], placed);
  const col3 = takeFromKeys(roles, ["material"], placed);
  const rows: SlotLayoutRow[] = [];
  if (col1 || col2 || col3) {
    rows.push({ cells: padRow([col1, col2, col3]) });
  }
  rows.push(...buildRemainderRows(roles, placed));
  return rows;
}
