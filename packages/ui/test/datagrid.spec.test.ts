/**
 * Specification tests (immutable oracles) — jsvision-ui RD-16 `DataGrid<T>` / `GridRows` / `GridHeader`
 * (ST-1…ST-19, ST-22, ST-23).
 *
 * Source of truth: RD-16 AC-1…AC-14 + the TV `TListViewer` decode in plans/table/03-01-data-grid.md
 * (GATE-1) + the register (AR-155/158/172/174/177/179/182). Turbo Vision has no table class — the
 * virtual-scroll row spine, the `│` divider (`\xB3`, `getColor(5)`, `tlstview.cpp:130`), and the
 * `cpListViewer` row colours are faithful; the header + heterogeneous columns + sort are the flagged
 * extension. Expectations derive from those docs, NEVER from the implementation. Draw assertions read
 * the `ScreenBuffer` pre-`serialize` (the shipped `listview.spec` pattern). `.js` per NodeNext.
 *
 * Geometry used throughout (viewport 24×12): the grid lays out `[header 1 | body 10 | hbar 1]`; the
 * body is `[rows fr | vbar 1]`, so header + rows are width 23. Columns `[Name 6, Age 5 (right), City
 * 1fr]` apportion over `23 − 3 dividers = 20` → widths `[6, 5, 9]`, starts `[0, 7, 13]`, dividers at
 * x `6, 12, 22`, totalWidth 23. Header is screen row 0; data row `i` is screen row `1 + i`.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { View, Group, createRenderRoot } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
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
function wheel(dir: 'up' | 'down', x: number, y: number) {
  return { type: 'wheel', dir, x, y, shift: false, alt: false, ctrl: false } as const;
}

interface Person {
  readonly name: string;
  readonly age: number;
  readonly city: string;
}

const CITIES = ['NY', 'LA', 'SF', 'DC'];
/** 24 people — enough to overflow a 10-row body. Ages are distinct-ish for sort checks. */
function people(n = 24): Person[] {
  return Array.from({ length: n }, (_, i) => ({ name: `P${i}`, age: 20 + ((i * 7) % 40), city: CITIES[i % 4] }));
}

/** The standard three columns (Name fixed, Age right-aligned numeric, City fr). */
function stdColumns(): Column<Person>[] {
  return [
    { title: 'Name', accessor: (p) => p.name, width: 6 },
    { title: 'Age', accessor: (p) => String(p.age), width: 5, align: 'right', compare: (a, b) => a.age - b.age },
    { title: 'City', accessor: (p) => p.city, width: '1fr' },
  ];
}

/** A post-process spy recording every command dispatched on the tick. */
class CommandSpy extends View {
  override postProcess = true;
  readonly commands: string[] = [];
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') this.commands.push(ev.event.command);
  }
}

/** Mount a DataGrid filling `w×h` under a root Group (+ optional spy) and focus its rows renderer. */
function hosted<T>(grid: DataGrid<T>, w: number, h: number, spy?: CommandSpy) {
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(grid);
  if (spy) root.add(spy);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  return loop;
}

// ── ST-1 — virtual scroll: only the visible window is materialized ────────────────────────────────
test('ST-1: renders only the visible rows of a 100-row grid; each row shows all 3 cells', () => {
  let accessorCalls = 0;
  const columns: Column<Person>[] = [
    { title: 'Name', accessor: (p) => (accessorCalls++, p.name), width: 6 },
    { title: 'Age', accessor: (p) => (accessorCalls++, String(p.age)), width: 5 },
    { title: 'City', accessor: (p) => (accessorCalls++, p.city), width: '1fr' },
  ];
  const grid = new DataGrid<Person>({ rows: signal(people(100)), columns });
  hosted(grid, 24, 12); // body = 10 rows
  // Virtual: 3 cols × ~10 visible rows ≈ 30 per compose; a generous ceiling absorbs a few recomposes.
  expect(accessorCalls).toBeLessThan(100 * 3);
  expect(accessorCalls).toBeGreaterThan(0);
});

// ── ST-2 — divider + normal row colour ────────────────────────────────────────────────────────────
test('ST-2: cells are separated by │ in the listDivider role; an unfocused row bg is listNormal', () => {
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: stdColumns() });
  const loop = hosted(grid, 24, 12);
  const buf = loop.renderRoot.buffer();
  // Data row 2 (screen y=3) is unfocused (focused defaults to row 0).
  expect(buf.get(0, 3)?.bg, 'unfocused row bg = listNormal cyan').toBe(defaultTheme.listNormal.bg);
  // Divider after the Name column (x=6) and after Age (x=12), listDivider blue-on-cyan.
  expect(buf.get(6, 3)?.char, 'divider glyph │').toBe('│');
  expect(buf.get(6, 3)?.fg, 'divider fg = listDivider blue').toBe(defaultTheme.listDivider.fg);
  expect(buf.get(12, 3)?.char).toBe('│');
});

// ── ST-3 — focused row colour + priority ─────────────────────────────────────────────────────────
test('ST-3: the focused row draws listFocused; others draw listNormal', () => {
  const focused = signal(0);
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: stdColumns(), focused });
  const loop = hosted(grid, 24, 12);
  const buf = () => loop.renderRoot.buffer();
  loop.dispatch(key('down'));
  loop.dispatch(key('down'));
  expect(focused()).toBe(2);
  expect(buf().get(0, 3)?.bg, 'row 2 (screen y=3) is focused → listFocused green').toBe(defaultTheme.listFocused.bg);
  expect(buf().get(0, 1)?.bg, 'row 0 is now only normal → listNormal cyan').toBe(defaultTheme.listNormal.bg);
});

// ── ST-4 — mixed fixed/fr/auto widths fill the viewport ──────────────────────────────────────────
test('ST-4: fixed/fr columns apportion so the last column ends at the rows right edge', () => {
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: stdColumns() });
  const loop = hosted(grid, 24, 12);
  const buf = loop.renderRoot.buffer();
  // The three dividers sit at x 6, 12, 22 (last divider at the rows right edge, width 23 → index 22).
  expect(buf.get(6, 3)?.char).toBe('│');
  expect(buf.get(12, 3)?.char).toBe('│');
  expect(buf.get(22, 3)?.char, 'the fr column ends flush at the right edge').toBe('│');
});

// ── ST-5 — right alignment inside a cell ─────────────────────────────────────────────────────────
test('ST-5: a right-aligned numeric cell is padded left within its column', () => {
  // One person, age 7 → "7" right-aligned in the width-5 Age column (starts at x=7): "    7".
  const rows = signal<Person[]>([{ name: 'A', age: 7, city: 'NY' }]);
  const grid = new DataGrid<Person>({ rows, columns: stdColumns() });
  const loop = hosted(grid, 24, 12);
  const buf = loop.renderRoot.buffer();
  // Age column content spans x 7..11; "7" lands at the last content cell x=11, x 7..10 are spaces.
  expect(buf.get(11, 1)?.char, 'the digit is right-aligned to the column end').toBe('7');
  expect(buf.get(7, 1)?.char, 'left padding is a space').toBe(' ');
});

// ── ST-6 — sticky header row ─────────────────────────────────────────────────────────────────────
test('ST-6: row 0 is a non-scrolling header of titles in the tableHeader role, same dividers', () => {
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: stdColumns() });
  const loop = hosted(grid, 24, 12);
  const buf = loop.renderRoot.buffer();
  expect(buf.get(0, 0)?.char, 'Name title starts at column start x=0').toBe('N');
  expect(buf.get(0, 0)?.bg, 'header bg = tableHeader cyan (0x3F)').toBe(defaultTheme.tableHeader.bg);
  expect(buf.get(0, 0)?.fg, 'header fg = tableHeader white').toBe(defaultTheme.tableHeader.fg);
  // Header columns align with the data columns: Age title starts at x=7, City at x=13.
  expect(buf.get(7, 0)?.char).toBe('A');
  expect(buf.get(13, 0)?.char).toBe('C');
  // Same divider columns in the header.
  expect(buf.get(6, 0)?.char).toBe('│');
});

// ── ST-7 — the header does not scroll with the data ──────────────────────────────────────────────
test('ST-7: paging the data leaves the header row unchanged', () => {
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: stdColumns() });
  const loop = hosted(grid, 24, 12);
  const buf = () => loop.renderRoot.buffer();
  const headerBefore = buf().get(0, 0)?.char;
  loop.dispatch(key('pagedown'));
  expect(buf().get(0, 0)?.char, 'header title unchanged after PgDn').toBe(headerBefore);
  expect(buf().get(0, 0)?.bg).toBe(defaultTheme.tableHeader.bg);
});

// ── ST-8 — click-to-sort toggles asc → desc with a ▲/▼ indicator ──────────────────────────────────
test('ST-8: clicking a header column sorts asc then desc with a ▲/▼ indicator', () => {
  const sort = signal<{ col: number; dir: 'asc' | 'desc' } | null>(null);
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: stdColumns(), sort });
  const loop = hosted(grid, 24, 12);
  const buf = () => loop.renderRoot.buffer();
  // Click the Age header (column 1, content 0-based x 7..11, header screen row 0 → 1-based y=1).
  loop.dispatch(mouse('down', 9, 1));
  loop.dispatch(mouse('up', 9, 1));
  expect(sort(), 'first click → asc').toEqual({ col: 1, dir: 'asc' });
  expect(buf().get(11, 0)?.char, '▲ ascending indicator at the Age column end').toBe('▲');
  // Second click toggles to descending.
  loop.dispatch(mouse('down', 9, 1));
  loop.dispatch(mouse('up', 9, 1));
  expect(sort(), 'second click → desc').toEqual({ col: 1, dir: 'desc' });
  expect(buf().get(11, 0)?.char, '▼ descending indicator').toBe('▼');
});

// ── ST-9 — numeric sort orders by the typed comparator ───────────────────────────────────────────
test('ST-9: a numeric column sorts by value; the top data row reflects the ascending order', () => {
  const rows = signal<Person[]>([
    { name: 'A', age: 9, city: 'NY' },
    { name: 'B', age: 10, city: 'LA' },
    { name: 'C', age: 2, city: 'SF' },
  ]);
  const grid = new DataGrid<Person>({ rows, columns: stdColumns() });
  const loop = hosted(grid, 24, 12);
  grid.sortBy(1, 'asc'); // Age ascending → [2, 9, 10] not lexical [10, 2, 9]
  loop.renderRoot.flush(); // sortBy sets a signal outside a dispatch tick → force the deferred frame
  const buf = loop.renderRoot.buffer();
  // Top data row (screen y=1) is C (age 2): its Name cell begins with 'C'.
  expect(buf.get(0, 1)?.char, 'the age-2 row (C) is first').toBe('C');
});

// ── ST-10 / ST-11 — horizontal scroll only when content overflows ────────────────────────────────
test('ST-10: overflowing fixed columns enable H-scroll; → increases indent and pans columns left', () => {
  const columns: Column<Person>[] = [
    { title: 'Name', accessor: (p) => p.name, width: 12 },
    { title: 'Age', accessor: (p) => String(p.age), width: 12 },
    { title: 'City', accessor: (p) => p.city, width: 12 }, // 36 + 3 dividers = 39 > 23 → overflow
  ];
  const indent = signal(0);
  const grid = new DataGrid<Person>({ rows: signal(people()), columns, indent });
  const loop = hosted(grid, 24, 12);
  loop.dispatch(key('right'));
  expect(indent(), 'the → key increases the horizontal indent when content overflows').toBeGreaterThan(0);
});

test('ST-11: all-fr columns exactly fill the viewport → no H-scroll (indent stays 0)', () => {
  const columns: Column<Person>[] = [
    { title: 'Name', accessor: (p) => p.name, width: '1fr' },
    { title: 'Age', accessor: (p) => String(p.age), width: '1fr' },
    { title: 'City', accessor: (p) => p.city, width: '2fr' },
  ];
  const indent = signal(0);
  const grid = new DataGrid<Person>({ rows: signal(people()), columns, indent });
  const loop = hosted(grid, 24, 12);
  loop.dispatch(key('right'));
  expect(indent(), 'no overflow → → is clamped to 0').toBe(0);
});

// ── ST-12 — Enter/Space selects + emits ──────────────────────────────────────────────────────────
test('ST-12: Enter on the focused row selects it, calls onSelect, and emits the command once', () => {
  const selected = signal(-1);
  const picks: Array<{ index: number; row: Person }> = [];
  const rows = signal(people());
  const grid = new DataGrid<Person>({
    rows,
    columns: stdColumns(),
    selected,
    command: 'chosen',
    onSelect: (index, row) => picks.push({ index, row }),
  });
  const spy = new CommandSpy();
  const loop = hosted(grid, 24, 12, spy);
  loop.dispatch(key('down'));
  loop.dispatch(key('down'));
  loop.dispatch(key('down')); // focus row 3
  loop.dispatch(key('enter'));
  expect(selected()).toBe(3);
  expect(picks).toEqual([{ index: 3, row: rows()[3] }]);
  expect(spy.commands).toContain('chosen');
});

// ── ST-13 — a single click focuses + selects but does NOT emit ───────────────────────────────────
test('ST-13: a single click on a data row focuses & selects it without emitting the command', () => {
  const focused = signal(0);
  const selected = signal(-1);
  const grid = new DataGrid<Person>({
    rows: signal(people()),
    columns: stdColumns(),
    focused,
    selected,
    command: 'chosen',
  });
  const spy = new CommandSpy();
  const loop = hosted(grid, 24, 12, spy);
  // Click data row 4 → screen 0-based row 1+4 = 5 → 1-based mouse y = 6.
  loop.dispatch(mouse('down', 1, 6));
  loop.dispatch(mouse('up', 1, 6));
  expect(focused()).toBe(4);
  expect(selected()).toBe(4);
  expect(spy.commands, 'a click never emits (emit is Enter/Space only)').not.toContain('chosen');
});

// ── ST-14 — focus is positional across a sort ────────────────────────────────────────────────────
test('ST-14: focused is a positional index — it stays put when the sort order changes', () => {
  const focused = signal(2);
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: stdColumns(), focused });
  hosted(grid, 24, 12);
  grid.sortBy(1, 'asc');
  expect(focused(), 'focused stays at index 2 (positional, not row-identity)').toBe(2);
  grid.sortBy(1, 'desc');
  expect(focused()).toBe(2);
});

// ── ST-15 — shrinking the data clamps focused into range ─────────────────────────────────────────
test('ST-15: replacing rows with a shorter array clamps focused to range−1', () => {
  const focused = signal(7);
  const rows = signal(people());
  const grid = new DataGrid<Person>({ rows, columns: stdColumns(), focused });
  hosted(grid, 24, 12);
  rows.set(people(3)); // now only 3 rows
  expect(focused(), 'clamped to range−1 = 2').toBe(2);
});

// ── ST-16 — empty rows draw <empty> ──────────────────────────────────────────────────────────────
test('ST-16: an empty grid draws the header + <empty> in the data area, no throw', () => {
  const grid = new DataGrid<Person>({ rows: signal<Person[]>([]), columns: stdColumns() });
  const loop = hosted(grid, 24, 12);
  const buf = loop.renderRoot.buffer();
  expect(buf.get(0, 0)?.char, 'header still drawn').toBe('N');
  // <empty> at data (col 1, row 0) → screen (x=1, y=1).
  expect(buf.get(1, 1)?.char).toBe('<');
});

// ── ST-17 — zero columns draw a blank field ──────────────────────────────────────────────────────
test('ST-17: zero columns draw a blank data field + blank header without throwing', () => {
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: [] });
  expect(() => hosted(grid, 24, 12)).not.toThrow();
});

// ── ST-18 — TListViewer paging (numCols ≡ 1) ─────────────────────────────────────────────────────
test('ST-18: PgDn pages by the body height; Ctrl+PgDn jumps to the last row', () => {
  const focused = signal(0);
  const grid = new DataGrid<Person>({ rows: signal(people(100)), columns: stdColumns(), focused });
  const loop = hosted(grid, 24, 12); // body = 10 rows
  loop.dispatch(key('pagedown'));
  expect(focused(), 'PgDn advances by the viewport row count (10)').toBe(10);
  loop.dispatch(key('pagedown', { ctrl: true }));
  expect(focused(), 'Ctrl+PgDn → last row (range−1)').toBe(99);
  loop.dispatch(key('pageup', { ctrl: true }));
  expect(focused(), 'Ctrl+PgUp → first row').toBe(0);
});

// ── ST-19 — mouse wheel ──────────────────────────────────────────────────────────────────────────
test('ST-19: the mouse wheel moves focus by ±3 (clamped)', () => {
  const focused = signal(0);
  const grid = new DataGrid<Person>({ rows: signal(people(100)), columns: stdColumns(), focused });
  const loop = hosted(grid, 24, 12);
  loop.dispatch(wheel('down', 1, 3));
  expect(focused()).toBe(3);
  loop.dispatch(wheel('up', 1, 3));
  expect(focused()).toBe(0);
});

// ── ST-22 — zebra striping (below focus/selection in priority) ───────────────────────────────────
test('ST-22: zebra stripes odd rows with staticText; a focused/selected row is not striped', () => {
  const focused = signal(0);
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: stdColumns(), focused, zebra: true });
  const loop = hosted(grid, 24, 12);
  const buf = loop.renderRoot.buffer();
  // Even data row 2 (screen y=3) → listNormal cyan; odd data row 3 (screen y=4) → staticText lightGray.
  expect(buf.get(0, 3)?.bg, 'even row = listNormal').toBe(defaultTheme.listNormal.bg);
  expect(buf.get(0, 4)?.bg, 'odd row = staticText stripe').toBe(defaultTheme.staticText.bg);
  // The focused row 0 (screen y=1) is NOT striped — it draws listFocused.
  expect(buf.get(0, 1)?.bg, 'focused row keeps its focus colour, never striped').toBe(defaultTheme.listFocused.bg);
});

// ── ST-23 — security: cell text is sanitized and width-clipped ───────────────────────────────────
test('ST-23: a cell accessor returning a raw ESC is sanitized; no control byte in the buffer', () => {
  const rows = signal<Person[]>([{ name: 'a\x1b[31mX', age: 1, city: 'NY' }]);
  const grid = new DataGrid<Person>({ rows, columns: stdColumns() });
  const loop = hosted(grid, 24, 12);
  const buf = loop.renderRoot.buffer();
  // Scan the Name column of the first data row (x 0..5, y=1): no raw ESC (0x1b) survives.
  for (let x = 0; x < 6; x += 1) {
    const ch = buf.get(x, 1)?.char ?? '';
    expect(ch.charCodeAt(0), `no ESC at (${x},1)`).not.toBe(0x1b);
  }
});

// A DataGrid exposes its focusable rows renderer as the focus target.
test('ST-1: DataGrid exposes its focusable rows renderer', () => {
  const grid = new DataGrid<Person>({ rows: signal(people()), columns: stdColumns() });
  const rr = createRenderRoot({ width: 24, height: 12 }, { caps });
  rr.mount(grid);
  expect(grid.rows.focusable).toBe(true);
});
