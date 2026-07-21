/**
 * Specification tests (immutable oracles) — the synthetic checkbox column + row-number gutter (RD-08
 * Phase 3; plan doc plans/rows-selection/03-03, 07-testing-strategy ST-13 … ST-15).
 *
 * Both are opt-in fixed-width prefix cells in the left-pinned region: a per-row `[ ]`/`[x]` checkbox with
 * a tri-state header box that drives the selection API, and a 1-based, right-aligned display-number
 * gutter that renumbers whenever the display re-derives. They are not caller columns and never scroll.
 *
 * Expectations derive from the requirements, never the implementation. Screen coords are 0-based; the
 * header sits at row 0, so body display row `r` renders at row `r + 1`.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 30;
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

function buildGrid(extra: Partial<EditableDataGridOptions<Person>> = {}) {
  const grid = new EditableDataGrid<Person>({
    columns: [column<Person, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 12 })],
    source: fromRows(signal(PEOPLE.map((p) => ({ ...p }))), { rowKey: (r) => r.id }),
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

/** Mouse-down at screen (x, y) in 1-based terminal coords. */
function click(loop: ReturnType<typeof buildGrid>['loop'], x0: number, y0: number) {
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: x0 + 1, y: y0 + 1 } as never);
  loop.renderRoot.flush();
}

const keysOf = (grid: EditableDataGrid<Person>): number[] => [...(grid.selectedKeys() as ReadonlySet<number>)].sort();

// ST-13 — a checkbox column: per-row [ ]/[x], a tri-state header box, and a per-row click toggles it.
test('ST-13: the checkbox column renders per-row boxes + a tri-state header and toggles on click', () => {
  const { grid, loop } = buildGrid({ checkboxColumn: true });
  expect(text(loop, 0, 0, 3)).toBe('[ ]'); // header tri-state: none selected
  expect(text(loop, 0, 1, 3)).toBe('[ ]'); // display row 0 unchecked
  // The first data column starts AFTER the 3-cell prefix (pinned left region), not at x=0.
  expect(text(loop, 3, 1, 3)).toBe('Ada');

  click(loop, 0, 1); // click display row 0's checkbox
  expect(keysOf(grid)).toEqual([1]);
  expect(text(loop, 0, 1, 3)).toBe('[x]'); // row 0 now checked
  expect(text(loop, 0, 0, 3)).toBe('[-]'); // header now 'some'

  click(loop, 0, 1); // toggle it back off
  expect(keysOf(grid)).toEqual([]);
  expect(text(loop, 0, 0, 3)).toBe('[ ]'); // header back to 'none'
});

// ST-14 — the header box select-all covers only the DISPLAYED (filtered) rows; the tri-state reflects it.
test('ST-14: the header checkbox selects all displayed (filtered) rows and shows all', () => {
  const { grid, loop } = buildGrid({ checkboxColumn: true });
  grid.setFilter('name', { kind: 'set', selected: new Set(['Ada', 'Cy']) }); // hide Bo (id 2)
  loop.renderRoot.flush();
  click(loop, 0, 0); // click the header select-all box
  expect(keysOf(grid)).toEqual([1, 3]); // only the two displayed rows — the filtered-out id 2 is NOT swept in
  expect(text(loop, 0, 0, 3)).toBe('[x]'); // all displayed rows selected → 'all'
});

// ST-15 — the row-number gutter is 1-based, right-aligned, and renumbers by display position after a sort.
test('ST-15: the row-number gutter shows 1-based display numbers that renumber after a sort', () => {
  const { grid, loop } = buildGrid({ rowNumbers: true });
  // rowCount 3 → gutter width 2 ("digits(3)=1" + 1 pad); numbers right-aligned then a pad cell.
  expect(text(loop, 0, 1, 2)).toBe('1 '); // display row 0 → "1"
  expect(text(loop, 0, 2, 2)).toBe('2 '); // display row 1 → "2"
  expect(text(loop, 0, 3, 2)).toBe('3 '); // display row 2 → "3"

  grid.sortBy('name', 'desc'); // Cy, Bo, Ada — the rows reorder
  loop.renderRoot.flush();
  // The gutter numbers stay 1,2,3 by DISPLAY POSITION (they renumber, not follow the rows).
  expect(text(loop, 0, 1, 2)).toBe('1 ');
  expect(text(loop, 0, 3, 2)).toBe('3 ');
  // The gutter is 2 cells wide ("1 "), so the data column starts at x=2.
  expect(text(loop, 2, 1, 2)).toBe('Cy'); // row 0 is now Cy (desc), numbered 1
});
