/**
 * Specification tests (immutable oracles) — row CRUD through the data-source mutation seam (RD-08
 * Phase 4; plan doc plans/rows-selection/03-04, 07-testing-strategy ST-16 … ST-18).
 *
 * Create / delete / duplicate route through the source's optional `insert`/`remove` seam (the grid never
 * persists on its own): `insertRow` splices at a source-array index, `deleteRows` removes by key and
 * prunes those keys from the selection, and `duplicateRow` inserts a structured-clone with a fresh key
 * from `assignKey` (a no-op + dev warning when `assignKey` is absent, so it never adds a key-colliding
 * row). The caller owns key generation.
 *
 * Expectations derive from the requirements, never the implementation. Screen coords are 0-based; the
 * header sits at row 0, so body display row `r` renders at row `r + 1`.
 */
import { test, expect, vi } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 20;
const H = 6;

interface Person {
  id: number;
  name: string;
}
const PEOPLE: Person[] = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Bo' },
  { id: 3, name: 'Cy' },
];

/** A fresh, independent copy of the seed rows (each test owns its own signal). */
const fresh = (): Signal<Person[]> => signal<Person[]>(PEOPLE.map((p) => ({ ...p })));

function buildGrid(rows: Signal<Person[]>, extra: Partial<EditableDataGridOptions<Person>> = {}) {
  const grid = new EditableDataGrid<Person>({
    columns: [column<Person, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 12 })],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    ...extra,
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  return { grid, loop };
}

/** Read `len` characters starting at (x, y) from the frame. */
function text(loop: ReturnType<typeof buildGrid>['loop'], x: number, y: number, len: number): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let i = 0; i < len; i += 1) s += buf.get(x + i, y)?.char ?? ' ';
  return s;
}

const keysOf = (grid: EditableDataGrid<Person>): number[] =>
  [...(grid.selectedKeys() as ReadonlySet<number>)].sort((a, b) => a - b);

// ST-16 — `insertRow` splices at a SOURCE index (append when omitted); with no active sort the source
// order is the display order, so the row lands at that display position.
test('ST-16: insertRow at a source index grows the length and lands at that display position', () => {
  const rows = fresh();
  const { grid, loop } = buildGrid(rows);
  grid.insertRow({ id: 99, name: 'Zed' }, 1); // splice into source index 1
  loop.renderRoot.flush();
  expect(rows().length).toBe(4); // the source grew by one
  expect(text(loop, 0, 1, 3)).toBe('Ada'); // display row 0 unchanged
  expect(text(loop, 0, 2, 3)).toBe('Zed'); // the inserted row is at display index 1 (source order)
  expect(text(loop, 0, 3, 2)).toBe('Bo'); // Bo pushed down one display row

  grid.insertRow({ id: 50, name: 'Meg' }); // `at` omitted → appended to the source
  expect(rows().length).toBe(5);
  expect(rows().at(-1)?.id).toBe(50);
});

// ST-17 — `deleteRows` removes the rows via the source seam AND prunes those keys from the selection.
test('ST-17: deleteRows removes the rows from the source and de-selects their keys', () => {
  const rows = fresh();
  const { grid } = buildGrid(rows);
  grid.selectRow(2); // {2}
  grid.toggleRow(3); // {2, 3}
  expect(keysOf(grid)).toEqual([2, 3]);

  grid.deleteRows([2]);
  expect(rows().some((r) => r.id === 2)).toBe(false); // id 2 removed from the source
  expect(rows().length).toBe(2);
  expect(keysOf(grid)).toEqual([3]); // the deleted key is pruned; the surviving selection stays
});

// ST-18 — `duplicateRow` inserts a fresh-key structured clone adjacent to the original; without
// `assignKey` it is a no-op + a dev warning (never a key-colliding insert).
test('ST-18: duplicateRow clones an adjacent fresh-key copy with assignKey; without it, a no-op + devWarn', () => {
  const rows = fresh();
  let nextId = 100;
  const { grid } = buildGrid(rows, { assignKey: (clone) => ({ ...clone, id: nextId++ }) });
  grid.duplicateRow(1); // clone Ada(1) → fresh id 100, inserted immediately after the original
  expect(rows().map((r) => r.id)).toEqual([1, 100, 2, 3]);
  expect(rows()[1].name).toBe('Ada'); // the clone copies the original's field values

  const rows2 = fresh();
  const { grid: grid2 } = buildGrid(rows2); // no assignKey
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  grid2.duplicateRow(1);
  expect(rows2().length).toBe(3); // unchanged — nothing inserted
  expect(warn).toHaveBeenCalledTimes(1); // and it warned rather than colliding a key
  warn.mockRestore();
});
