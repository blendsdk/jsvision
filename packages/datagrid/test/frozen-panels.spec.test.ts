/**
 * Specification tests (immutable oracles) — frozen L/C/R panels on `EditableDataGrid` (plan doc
 * plans/columns-layout/03-02, 07-testing-strategy ST-14 … ST-19).
 *
 * When freeze is configured the body splits into left / center / right panels sharing one row cursor,
 * one vertical scroll, and one global column cursor; only the center scrolls horizontally; a divider
 * marks each freeze boundary; the header stays sticky; over-pinning is clamped with a dev warning; and
 * a non-frozen grid keeps the single-body path. Expectations derive from the requirements + frozen
 * theme roles, never the implementation.
 */
import { test, expect, vi } from 'vitest';
import { Group, View, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { Column } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
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
const EMPS: Emp[] = [
  { id: 1, name: 'Ada', city: 'NYC', dept: 'Eng', note: 'alpha' },
  { id: 2, name: 'Bo', city: 'LA', dept: 'Ops', note: 'bravo' },
  { id: 3, name: 'Cy', city: 'SF', dept: 'Sales', note: 'charlie' },
];
const COLS = () => [
  column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 5 }),
  column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 }),
  column<Emp, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 8 }),
  column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 10 }),
  column<Emp, string>({ id: 'note', title: 'Note', value: (r) => r.note, width: 12 }),
];

const W = 30;
const H = 6;

/** Mount an `EditableDataGrid` with the given options; return the grid, loop, and a styled-frame reader. */
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
  const cellAt = (x: number, y: number) => {
    loop.renderRoot.flush();
    return loop.renderRoot.buffer().get(x, y);
  };
  const rowText = (y: number): string => {
    loop.renderRoot.flush();
    const buf = loop.renderRoot.buffer();
    let s = '';
    for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
    return s;
  };
  /** The x of the first cell whose char is `ch` on row `y`, or -1. */
  const xOf = (y: number, ch: string): number => rowText(y).indexOf(ch);
  return { grid, loop, cellAt, rowText, xOf };
}

// ST-14 — with freeze:2 the frozen columns do NOT move when the center scrolls horizontally, and a
// `│` freeze divider separates the panels.
test('ST-14: frozen columns stay put under center H-scroll; a divider separates the panels', () => {
  const { grid, rowText } = buildGrid({ freeze: 2 });
  const before = rowText(1); // first body row, before any scroll
  const adaX = before.indexOf('Ada'); // a frozen (name) cell
  expect(adaX).toBeGreaterThanOrEqual(0);
  expect(before).toContain('│'); // a freeze divider is drawn

  // Scroll the center panel far right.
  for (let i = 0; i < 8; i += 1) grid.rows.onEvent({ event: key('right'), handled: false } as never);
  const after = rowText(1);
  expect(after.indexOf('Ada')).toBe(adaX); // the frozen 'Ada' cell did NOT move
});

// ST-15 — the focused-row highlight spans every panel (one shared row cursor). The cursor cell itself
// (a distinct overpaint) is excluded: the highlight is read from a non-cursor cell in each panel.
test('ST-15: the focused-row highlight spans all panels', () => {
  const { grid, loop, cellAt, rowText } = buildGrid({ freeze: 2 });
  loop.focusView(grid.rows);
  loop.dispatch(key('down')); // focus row index 1 → screen y = 2 (header y0, rows y1..)
  const y = 2;
  const line = rowText(y); // row 1 renders "2 │Bo │LA │Ops …" — id (cursor) frozen, name frozen, city center
  const leftX = line.indexOf('Bo'); // a frozen LEFT-panel cell, NOT the cursor column
  const centerX = line.indexOf('LA'); // a CENTER-panel cell (past the freeze boundary)
  expect(leftX).toBeGreaterThan(0);
  expect(centerX).toBeGreaterThan(leftX);
  expect(cellAt(leftX, y)?.bg).toBe(defaultTheme.listFocused.bg); // left (frozen) panel row highlighted
  expect(cellAt(centerX, y)?.bg).toBe(defaultTheme.listFocused.bg); // center panel row highlighted too
});

// ST-16 — the header row stays fixed while the body scrolls vertically (sticky header).
test('ST-16: the header stays fixed during vertical scroll', () => {
  const { grid, loop, rowText } = buildGrid({ freeze: 2 });
  const header = rowText(0);
  expect(header).toContain('ID');
  expect(header).toContain('Name');
  loop.focusView(grid.rows);
  loop.dispatch(key('pagedown')); // scroll the body to the bottom
  expect(rowText(0)).toBe(header); // header unchanged
});

// ST-17 — over-pinning (frozen width ≥ viewport) is clamped with a single dev warning; the center is
// never blank.
test('ST-17: over-pinning is clamped with one dev warning and a non-blank center', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    // Freeze every column → the frozen width exceeds the 30-wide viewport.
    const { rowText } = buildGrid({ freezeLeft: ['id', 'name', 'city', 'dept', 'note'] });
    const body = rowText(1);
    expect(body.trim().length).toBeGreaterThan(0); // the body is not blank
    expect(warn).toHaveBeenCalled(); // a dev warning fired
  } finally {
    warn.mockRestore();
  }
});

// ST-18 — the column cursor is linear: ← / → cross the freeze boundary, and Ctrl+Home / Ctrl+End span
// the whole grid. Tested at the panel level with a shared global cursor + a cross-panel hop.
test('ST-18: the global column cursor crosses panel boundaries and Ctrl+Home/End span the grid', () => {
  const focusedCol = signal(0);
  const focused = signal(0);
  const selected = signal(-1);
  const cols: Column<Emp>[] = COLS().map((c) => ({
    title: c.title,
    accessor: (r) => String(c.value(r)),
    width: 6,
  }));
  const N = cols.length; // 5 total columns
  const built: EditableGridRows<Emp>[] = [];
  const focusPanel = (globalCol: number, ev: { focusView?: (v: View) => void }): void => {
    const owner = built.find((p) => globalCol >= p.columnOffset && globalCol < p.columnOffset + p.columnCount);
    if (owner) ev.focusView?.(owner);
  };
  const panel = (offset: number, count: number): EditableGridRows<Emp> =>
    new EditableGridRows<Emp>({
      display: () => EMPS,
      columns: cols.slice(offset, offset + count),
      autoWidths: () => cols.slice(offset, offset + count).map(() => null),
      indent: signal(0),
      focused,
      selected,
      zebra: false,
      focusedCol,
      typedColumns: COLS().slice(offset, offset + count),
      overlay: new Group(),
      rowKey: (r) => r.id,
      bumpVersion: () => undefined,
      columnOffset: offset,
      totalCols: () => N,
      onCursorEnterPanel: focusPanel,
    });
  const left = panel(0, 2); // columns 0,1
  const center = panel(2, 3); // columns 2,3,4
  built.push(left, center);
  const root = new Group();
  const stub = new (class extends View {
    override focusable = true;
    override draw(): void {}
  })();
  root.add(left);
  root.add(center);
  root.add(stub);
  left.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 14, height: H } });
  center.setLayout({ position: 'absolute', rect: { x: 14, y: 0, width: 16, height: H } });
  stub.setLayout({ position: 'absolute', rect: { x: 0, y: H - 1, width: 1, height: 1 } });
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(left); // start in the left (frozen) panel

  expect(focusedCol()).toBe(0);
  loop.dispatch(key('right')); // 0 → 1 (still left)
  loop.dispatch(key('right')); // 1 → 2 (crosses into center; hop re-focuses the center panel)
  expect(focusedCol()).toBe(2);
  loop.dispatch(key('right')); // 2 → 3 (center now handles it — proving the hop worked)
  expect(focusedCol()).toBe(3);
  loop.dispatch(key('home', { ctrl: true })); // → grid start (col 0, back in the left panel)
  expect(focusedCol()).toBe(0);
  loop.dispatch(key('end', { ctrl: true })); // → grid end (last col)
  expect(focusedCol()).toBe(N - 1);
});

// ST-19 — a grid with no freeze keeps the single-body path (no panels, empty partition).
test('ST-19: a non-frozen grid keeps the single-body path', () => {
  const { grid, rowText } = buildGrid();
  expect(grid.frozen()).toEqual({ left: [], right: [] });
  expect(grid.rows).toBeInstanceOf(EditableGridRows); // the single focusable body
  expect(rowText(1)).toContain('Ada'); // it renders
});
