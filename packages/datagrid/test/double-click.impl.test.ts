/**
 * Implementation tests — internals and edges of mouse double-click-to-edit and single-click cell focus.
 *
 * These cover behaviour beyond the spec oracle: per-column single-click resolution, the read-only
 * double-click falling through to the base row-activate, and click-count reset when the two downs land on
 * different cells. They may evolve with the implementation, unlike the spec oracle. Coordinates are
 * 1-based; body display row `r` is `y = r + 2`.
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false };
}

interface Person {
  id: number;
  name: string;
  city: string;
}
const editable = (id: 'name' | 'city', title: string) =>
  column<Person, string>({
    id,
    title,
    value: (r) => r[id],
    parse: (t) => t,
    set: (r, v) => {
      r[id] = v;
    },
    width: 8,
  });
const READONLY_ID = column<Person, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 6 });

const W = 24;
const H = 6;
const X_NAME = 2;
const X_CITY = 11;
const X_ID = 20;

function build() {
  const rows = signal<Person[]>([
    { id: 1, name: 'Ada', city: 'NYC' },
    { id: 2, name: 'Bo', city: 'LA' },
    { id: 3, name: 'Cy', city: 'SF' },
  ]);
  const grid = new EditableDataGrid<Person>({
    columns: [editable('name', 'Name'), editable('city', 'City'), READONLY_ID],
    source: fromRows(rows, { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const clock = { t: 0 };
  const loop = createEventLoop({ width: W, height: H }, { caps, now: () => clock.t });
  loop.mount(root);
  loop.focusView(grid.rows);
  return { grid, loop, rows, clock };
}

function down(loop: ReturnType<typeof build>['loop'], x: number, r: number) {
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x, y: r + 2 } as never);
}
function fieldValue(loop: ReturnType<typeof build>['loop']): string {
  const editor = loop.getFocused();
  return editor instanceof Input ? editor.getValueSignal()() : '';
}

test('single-body single-click resolves the clicked column for a later edit', () => {
  const a = build();
  down(a.loop, X_NAME, 1); // click Name on row 1
  a.loop.dispatch(key('f2'));
  expect(fieldValue(a.loop)).toBe('Bo'); // Name[row 1]

  const b = build();
  down(b.loop, X_CITY, 2); // click City on row 2
  b.loop.dispatch(key('f2'));
  expect(fieldValue(b.loop)).toBe('SF'); // City[row 2]
});

test('a double-click on an editable cell seeds the editor from the cell value (not a replace)', () => {
  const g = build();
  down(g.loop, X_NAME, 0);
  g.clock.t = 120;
  down(g.loop, X_NAME, 0);
  expect(g.grid.overlay.children.length).toBe(1);
  expect(fieldValue(g.loop)).toBe('Ada'); // seeded with the existing value, not replaced
});

test('a read-only double-click mounts no editor but focuses the clicked row (base activate)', () => {
  const g = build();
  down(g.loop, X_ID, 2);
  g.clock.t = 120;
  down(g.loop, X_ID, 2); // double-click the read-only ID cell on row 2
  expect(g.grid.overlay.children.length).toBe(0); // no editor
  expect(g.grid.focusedRow()?.id).toBe(3); // the base focused the clicked row
});

test('two rapid downs on different cells do not begin an edit (click count resets)', () => {
  const g = build();
  down(g.loop, X_NAME, 0);
  g.clock.t = 100; // within the window, but a different cell
  down(g.loop, X_CITY, 0);
  expect(g.grid.overlay.children.length).toBe(0); // second down is a fresh single click, not a double
});
