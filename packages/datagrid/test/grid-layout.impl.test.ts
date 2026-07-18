/**
 * Implementation tests — the reactive body rebuild that makes the column-layout STATE (locked by
 * grid-layout.spec.test.ts) drive the RENDER: hiding/showing a column, reordering columns, and
 * resizing a frozen column all re-run the body assembly so the painted grid reflects the change. A
 * scrolling-column resize is handled live (no rebuild) and is covered by resize-reorder.impl.test.ts.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Emp {
  id: number;
  name: string;
  dept: string;
}
const EMPS: Emp[] = [
  { id: 1, name: 'Ada', dept: 'Eng' },
  { id: 2, name: 'Bo', dept: 'Ops' },
];
const COLS = () => [
  column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 6, minWidth: 4 }),
  column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 }),
  column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
];

const W = 30;
const H = 6;

function buildGrid(extra: Partial<EditableDataGridOptions<Emp>> = {}) {
  const grid = new EditableDataGrid<Emp>({
    columns: COLS(),
    source: fromRows(signal(EMPS.slice()), { rowKey: (r) => r.id }),
    ...extra,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  const frame = (): string => {
    loop.renderRoot.flush();
    const buf = loop.renderRoot.buffer();
    const lines: string[] = [];
    for (let y = 0; y < H; y += 1) {
      let s = '';
      for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
      lines.push(s);
    }
    return lines.join('\n');
  };
  const header = (): string => frame().split('\n')[0];
  return { grid, loop, frame, header };
}

// Hiding a column removes it from the painted grid; showing it brings it back — the body rebuilt.
test('setColumnVisible rebuilds the body so a hidden column leaves the render (and returns)', () => {
  const { grid, frame } = buildGrid();
  expect(frame()).toContain('Name');
  expect(frame()).toContain('Ada');
  grid.setColumnVisible('name', false);
  expect(frame()).not.toContain('Name'); // the column left the render
  expect(frame()).not.toContain('Ada');
  grid.setColumnVisible('name', true);
  expect(frame()).toContain('Name'); // and returns
  expect(frame()).toContain('Ada');
});

// Reordering the visible columns repaints them in the new order.
test('setColumnOrder rebuilds the body in the new column order', () => {
  const { grid, header } = buildGrid();
  expect(header().indexOf('ID')).toBeLessThan(header().indexOf('Dept')); // ID before Dept initially
  grid.setColumnOrder(['dept', 'id', 'name']);
  expect(header().indexOf('Dept')).toBeLessThan(header().indexOf('ID')); // Dept now precedes ID
});

// A rebuild while the grid is focused re-homes focus into the new body — keyboard nav survives.
test('a rebuild while focused keeps the grid interactive (focus heals into the new body)', () => {
  const { grid, loop, frame } = buildGrid();
  loop.focusView(grid.rows);
  loop.dispatch({ type: 'key', key: 'down', ctrl: false, alt: false, shift: false } as never); // row 1
  grid.setColumnVisible('dept', false); // rebuild while focused (hide a column other than 'name')
  loop.renderRoot.flush();
  const focused = loop.getFocused();
  expect(focused).not.toBeNull(); // focus was re-homed into the rebuilt body, not dropped
  // The grid still responds to the keyboard after the rebuild.
  loop.dispatch({ type: 'key', key: 'up', ctrl: false, alt: false, shift: false } as never);
  expect(frame()).toContain('Ada'); // still rendering the (remaining) data, no crash
  expect(frame()).not.toContain('Dept'); // the hidden column stayed hidden across the keypress
});

// Resizing a FROZEN column resizes its fixed panel band, so the freeze boundary moves in the render.
test('resizing a frozen column rebuilds so its panel band (and the freeze boundary) grows', () => {
  const { grid, header } = buildGrid({ freeze: 1 }); // id frozen; the freeze divider sits at the id band edge
  const boundaryBefore = header().indexOf('│'); // the first │ is the freeze boundary (id is the only frozen col)
  expect(boundaryBefore).toBe(6); // id band width 6
  grid.setColumnWidth('id', 12);
  expect(header().indexOf('│')).toBe(12); // the frozen band widened → the boundary moved right
});
