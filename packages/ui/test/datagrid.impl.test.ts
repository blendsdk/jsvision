/**
 * Implementation tests — jsvision-ui RD-16 `DataGrid` internals and edges.
 *
 * Covers the H-indent clamp, header/row divider-column alignment (same width `W−1`, PF-101), the
 * sort indicator on a title-width column (title clipped to `width−1`, arrow still shown, PF-103),
 * zebra+focus interaction, a click below the last row, and Home/End/Ctrl paging. Complements the
 * datagrid.spec oracles. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { DataGrid } from '../src/table/index.js';
import type { Column } from '../src/table/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

interface Person {
  readonly name: string;
  readonly age: number;
  readonly city: string;
}
const CITIES = ['NY', 'LA', 'SF', 'DC'];
function people(n = 24): Person[] {
  return Array.from({ length: n }, (_, i) => ({ name: `P${i}`, age: 20 + ((i * 7) % 40), city: CITIES[i % 4] }));
}
function stdColumns(): Column<Person>[] {
  return [
    { title: 'Name', accessor: (p) => p.name, width: 6 },
    { title: 'Age', accessor: (p) => String(p.age), width: 5, align: 'right', compare: (a, b) => a.age - b.age },
    { title: 'City', accessor: (p) => p.city, width: '1fr' },
  ];
}

function hosted<T>(grid: DataGrid<T>, w: number, h: number) {
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  return loop;
}

test('the horizontal indent clamps to totalWidth − viewport (no over-scroll)', () => {
  // Three 12-wide fixed columns → widths [12,12,12], totalWidth 36+3 = 39; rows width 23 → maxIndent 16.
  const columns: Column<Person>[] = [
    { title: 'A', accessor: (p) => p.name, width: 12 },
    { title: 'B', accessor: (p) => String(p.age), width: 12 },
    { title: 'C', accessor: (p) => p.city, width: 12 },
  ];
  const indent = signal(0);
  const grid = new DataGrid<Person>({ rows: signal(people()), columns, indent });
  const loop = hosted(grid, 24, 12);
  for (let i = 0; i < 40; i += 1) loop.dispatch(key('right'));
  expect(indent(), 'indent clamps at totalWidth − viewport = 16').toBe(16);
  for (let i = 0; i < 40; i += 1) loop.dispatch(key('left'));
  expect(indent(), 'and back to 0').toBe(0);
});

test('the header divider columns align exactly with the data-row divider columns (PF-101)', () => {
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: stdColumns() });
  const loop = hosted(grid, 24, 12);
  const buf = loop.renderRoot.buffer();
  for (const x of [6, 12, 22]) {
    expect(buf.get(x, 0)?.char, `header divider at x=${x}`).toBe('│');
    expect(buf.get(x, 3)?.char, `row divider at x=${x} (aligned)`).toBe('│');
  }
});

test('a sorted title-width column clips the title to width−1 and still shows the arrow (PF-103)', () => {
  // One width-3 column titled "Age" (title width == column width). Sorted → "Ag▲".
  const columns: Column<Person>[] = [{ title: 'Age', accessor: (p) => String(p.age), width: 3 }];
  const grid = new DataGrid<Person>({ rows: signal(people()), columns });
  const loop = hosted(grid, 24, 12);
  grid.sortBy(0, 'asc');
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  expect(buf.get(0, 0)?.char).toBe('A');
  expect(buf.get(1, 0)?.char).toBe('g');
  expect(buf.get(2, 0)?.char, 'the arrow takes the last content cell (title clipped to "Ag")').toBe('▲');
  expect(buf.get(3, 0)?.char, 'divider still at the column right edge').toBe('│');
});

test('a focused row is never zebra-striped even at an odd index', () => {
  const focused = signal(3); // odd index → would be striped if not focused
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: stdColumns(), focused, zebra: true });
  const loop = hosted(grid, 24, 12);
  const buf = loop.renderRoot.buffer();
  // Focused odd row 3 → screen y = 1 + 3 = 4; draws listFocused, NOT the staticText stripe.
  expect(buf.get(0, 4)?.bg, 'focus outranks the zebra stripe').toBe(defaultTheme.listFocused.bg);
});

test('a click below the last row focuses the last item (focusItemNum clamp)', () => {
  const focused = signal(0);
  const grid = new DataGrid<Person>({ rows: signal(people(3)), columns: stdColumns(), focused });
  const loop = hosted(grid, 24, 12);
  // Click deep in the blank area below the 3 rows (screen 0-based y=8 → mouse y=9).
  loop.dispatch(mouse('down', 1, 9));
  loop.dispatch(mouse('up', 1, 9));
  expect(focused(), 'clamped to the last row (range−1 = 2)').toBe(2);
});

test('Home returns to topItem; End goes to the last visible row', () => {
  const focused = signal(0);
  const grid = new DataGrid<Person>({ rows: signal(people(100)), columns: stdColumns(), focused });
  const loop = hosted(grid, 24, 12); // body = 10 rows
  loop.dispatch(key('pagedown')); // focus 10, window scrolls (topItem 1)
  loop.dispatch(key('home'));
  expect(focused(), 'Home → topItem').toBe(1);
  loop.dispatch(key('end'));
  expect(focused(), 'End → topItem + viewportRows − 1').toBe(10);
});
