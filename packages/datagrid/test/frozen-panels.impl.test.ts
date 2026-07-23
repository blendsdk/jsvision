/**
 * Implementation tests — internal invariants of the frozen L/C/R panels that the spec oracles don't
 * pin down:
 *  - the three panels stay vertically locked to one shared top row (PF-008: `topItem` agreement is a
 *    load-bearing invariant — if the panels disagreed, the same screen row would show different records
 *    in different panels),
 *  - the center panel auto-scrolls horizontally to keep the focused column on screen, and
 *  - an edit on a frozen cell mounts its editor over that frozen panel (the left panel's x-range).
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false, ...mods };
}

interface Emp {
  id: number;
  name: string;
  city: string;
  dept: string;
  note: string;
}
// Ten rows, each field tagged with the row's id, so a mismatch between panels is detectable: id N always
// pairs with city `C{N}` — if the left and center panels scrolled to different tops, the numbers diverge.
const EMPS: Emp[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: `N${i + 1}`,
  city: `C${i + 1}`,
  dept: `D${i + 1}`,
  note: `Zz${i + 1}`,
}));
const COLS = () => [
  column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 5 }),
  column<Emp, string>({
    id: 'name',
    title: 'Name',
    value: (r) => r.name,
    width: 8,
    parse: (t) => t, // editable frozen column — used by the mount-over-panel test
    set: (r, v) => {
      r.name = v;
    },
  }),
  column<Emp, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 8 }),
  column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 10 }),
  column<Emp, string>({ id: 'note', title: 'Note', value: (r) => r.note, width: 12 }),
];

const W = 30;
const H = 6;

function buildGrid(extra: Partial<EditableDataGridOptions<Emp>> = {}) {
  const grid = new EditableDataGrid<Emp>({
    columns: COLS(),
    source: fromRows(signal(EMPS.slice()), { rowKey: (r) => r.id }),
    ...extra,
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  const rowText = (y: number): string => {
    loop.renderRoot.flush();
    const buf = loop.renderRoot.buffer();
    let s = '';
    for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
    return s;
  };
  return { grid, loop, rowText };
}

// PF-008 — after a vertical scroll every panel shows the SAME record on a given screen row. With freeze:2
// the id (left panel, x 0..4) and city (center panel, x 15..22) carry the same tag, so a top-row
// disagreement would show e.g. id 5 beside city C6. They must match, proving one shared `topItem`.
test('the frozen panels stay vertically locked to one shared top row', () => {
  const { grid, loop, rowText } = buildGrid({ freeze: 2 });
  loop.focusView(grid.rows);
  loop.dispatch(key('pagedown')); // scroll the body down so a non-zero top row is showing
  for (let y = 1; y <= H - 2; y += 1) {
    const line = rowText(y);
    const id = line.slice(0, 5).trim();
    const city = line.slice(15, 23).trim();
    if (id === '' && city === '') continue; // a trailing blank row past the data end
    expect(city).toBe(`C${id}`); // the left (id) and center (city) panels agree on the record at this row
  }
});

// The center panel scrolls horizontally to reveal the focused column. Its rightmost column ('note') is
// off-screen at rest in the 30-wide viewport; moving the cursor to it (Ctrl+End) must scroll it into view.
test('the center panel auto-scrolls to keep the focused column visible', () => {
  const { grid, loop, rowText } = buildGrid({ freeze: 1 });
  loop.focusView(grid.rows);
  expect(rowText(1)).not.toContain('Zz1'); // the last (note) column is off-screen at rest
  for (let i = 0; i < 4; i += 1) loop.dispatch(key('right')); // cursor → the last column (note), same row
  expect(rowText(1)).toContain('Zz1'); // the center scrolled right to reveal the focused column
});

// An edit begun on a frozen cell mounts its editor over the frozen panel: 'name' is a frozen (left-panel)
// editable column, so its editor lands left of the freeze boundary (the left band is 14 cells wide).
test('editing a frozen cell mounts the editor over the frozen panel', () => {
  const { grid, loop } = buildGrid({ freeze: 2 });
  loop.focusView(grid.rows);
  loop.dispatch(key('right')); // cursor 0 → 1 ('name', still the frozen left panel)
  loop.dispatch(key('f2')); // begin editing the frozen 'name' cell
  const editor = loop.getFocused();
  expect(editor).toBeInstanceOf(Input);
  loop.renderRoot.flush();
  if (editor instanceof Input) {
    expect(editor.getValueSignal()()).toBe('N1'); // seeded from the frozen 'name' column
    expect(editor.bounds.x).toBeGreaterThanOrEqual(0);
    expect(editor.bounds.x).toBeLessThan(14); // left of the freeze boundary → over the left (frozen) panel
  }
});
