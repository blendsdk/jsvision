/**
 * Implementation tests (edges/internals) — synthetic prefix (RD-08 Phase 3).
 *
 * The spec oracles (`synthetic-columns.spec.test.ts`, ST-13 … ST-15) pin the container behaviour; these
 * cover the pure geometry/glyph helpers and the rendering internals: the prefix aligns across the
 * header, body, and pinned frozen-rows band; it composes with frozen columns; and with neither
 * affordance enabled the body is byte-identical (no reserved prefix).
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';
import { prefixWidth, checkboxGlyph, headerCheckboxGlyph, gutterLabel } from '../src/synthetic-columns.js';

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
    columns: [
      column<Person, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 4 }),
      column<Person, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
    ],
    source: fromRows(signal(PEOPLE.map((p) => ({ ...p }))), { rowKey: (r) => r.id }),
    ...extra,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  return { grid, loop };
}

function text(loop: ReturnType<typeof buildGrid>['loop'], x: number, y: number, len: number): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let i = 0; i < len; i += 1) s += buf.get(x + i, y)?.char ?? ' ';
  return s;
}

// --- Pure helpers ---

test('prefixWidth sums the enabled affordances (checkbox 3 + gutter digits+1)', () => {
  expect(prefixWidth({ checkbox: false, rowNumbers: false, rowCount: 9 })).toBe(0);
  expect(prefixWidth({ checkbox: true, rowNumbers: false, rowCount: 0 })).toBe(3);
  expect(prefixWidth({ checkbox: false, rowNumbers: true, rowCount: 5 })).toBe(2); // "5" → 1 digit + 1 pad
  expect(prefixWidth({ checkbox: false, rowNumbers: true, rowCount: 100 })).toBe(4); // "100" → 3 + 1
  expect(prefixWidth({ checkbox: true, rowNumbers: true, rowCount: 5 })).toBe(5); // 3 + 2
});

test('the glyph helpers render the fixed ASCII boxes and a right-aligned gutter', () => {
  expect(checkboxGlyph(true)).toBe('[x]');
  expect(checkboxGlyph(false)).toBe('[ ]');
  expect(headerCheckboxGlyph('none')).toBe('[ ]');
  expect(headerCheckboxGlyph('some')).toBe('[-]');
  expect(headerCheckboxGlyph('all')).toBe('[x]');
  expect(gutterLabel(0, 4)).toBe('  1 '); // right-aligned in width-1, trailing pad
  expect(gutterLabel(99, 4)).toBe('100 ');
});

// --- Rendering internals ---

test('the checkbox aligns across the header box and the body rows (same x)', () => {
  const { grid, loop } = buildGrid({ checkboxColumn: true });
  grid.selectRow(2); // check display row 1 (id 2)
  loop.renderRoot.flush();
  expect(text(loop, 0, 0, 3)).toBe('[-]'); // header box (screen row 0), x=0
  expect(text(loop, 0, 1, 3)).toBe('[ ]'); // body row 0 (screen row 1), x=0 — aligned
  expect(text(loop, 0, 2, 3)).toBe('[x]'); // body row 1 (screen row 2), x=0 — checked, aligned
});

test('the prefix composes with frozen columns (checkbox rides the left-pinned region)', () => {
  const { loop } = buildGrid({ checkboxColumn: true, freeze: 1 });
  // The checkbox band is the leftmost segment (x=0..2); the frozen id column follows it.
  expect(text(loop, 0, 1, 3)).toBe('[ ]'); // display row 0 checkbox at x=0
  expect(text(loop, 3, 1, 1)).toBe('1'); // the frozen id column ("1") begins after the 3-cell prefix
});

test('the prefix aligns onto the pinned frozen-rows band', () => {
  const { grid, loop } = buildGrid({ checkboxColumn: true, freezeRows: 1 });
  grid.selectRow(1); // check id 1 (the pinned row 0)
  loop.renderRoot.flush();
  // header row 0; pinned band row at screen row 1; scrolling body from screen row 2.
  expect(text(loop, 0, 1, 3)).toBe('[x]'); // the pinned row 0's checkbox, aligned at x=0
  expect(text(loop, 0, 2, 3)).toBe('[ ]'); // the first scrolling row's checkbox, aligned at x=0
});

test('with neither affordance the body reserves no prefix (data starts at x=0)', () => {
  const off = buildGrid(); // no checkboxColumn / rowNumbers
  expect(text(off.loop, 0, 1, 1)).toBe('1'); // the id column renders at x=0 — no reserved prefix
  const on = buildGrid({ checkboxColumn: true });
  expect(text(on.loop, 3, 1, 1)).toBe('1'); // …vs shifted to x=3 when the checkbox column is on
});
