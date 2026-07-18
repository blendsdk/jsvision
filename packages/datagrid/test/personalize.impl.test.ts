/**
 * Implementation tests — the personalize dialog's internals and edges: the freeze cycle wraps, reorder
 * is a no-op at both boundaries, the body renders (its fill region does not collapse to width 0), and
 * the visible-count echo tracks the pending visibility. Driven on a headless modal host.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { personalizeGrid } from '../src/personalize.js';
import { createMemoryVariantStore } from '../src/variant-store.js';
import type { PersonalizeDialog } from '../src/personalize-dialog.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Emp {
  id: number;
  name: string;
  dept: string;
  total: number;
  note: string;
  active: boolean;
}
const EMPS: Emp[] = [{ id: 1, name: 'Ann', dept: 'Eng', total: 10, note: 'a', active: true }];
const COLS = () => [
  column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 5 }),
  column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 }),
  column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
  column<Emp, number>({ id: 'total', title: 'Total', value: (r) => r.total, width: 6, minWidth: 4, maxWidth: 40 }),
  column<Emp, string>({ id: 'note', title: 'Note', value: (r) => r.note, width: 6 }),
  column<Emp, boolean>({ id: 'active', title: 'Active', value: (r) => r.active, width: 6 }),
];

function buildGrid(): EditableDataGrid<Emp> {
  const grid = new EditableDataGrid<Emp>({
    columns: COLS(),
    source: fromRows(signal(EMPS.slice()), { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 50, height: 8 } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 50, height: 8 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return grid;
}

function makeHost(w = 70, h = 24) {
  const root = new Group();
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  const added: View[] = [];
  const host = {
    loop,
    desktop: {
      addWindow: (v: View) => {
        added.push(v);
        root.add(v);
      },
      removeWindow: (v: View) => root.remove(v),
      bounds: { x: 0, y: 0, width: w, height: h },
    },
  };
  return { loop, host, added };
}

function open(grid: EditableDataGrid<Emp>) {
  const { loop, host, added } = makeHost();
  const result = personalizeGrid(grid, { store: createMemoryVariantStore(), host });
  loop.renderRoot.flush();
  return { loop, dlg: added[0] as unknown as PersonalizeDialog<Emp>, result };
}

const painted = (loop: ReturnType<typeof createEventLoop>): string =>
  loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((c) => c.char).join(''))
    .join('\n');

// The freeze cycle wraps: none → left → right → none → left …
test('the freeze cycle wraps back to none after right', () => {
  const { dlg } = open(buildGrid());
  dlg.select(dlg.indexOf('id'));
  const sideOf = () => dlg.workingColumns().find((c) => c.id === 'id')!.freeze;
  expect(sideOf()).toBe('none');
  dlg.cycleSelectedFreeze();
  expect(sideOf()).toBe('left');
  dlg.cycleSelectedFreeze();
  expect(sideOf()).toBe('right');
  dlg.cycleSelectedFreeze();
  expect(sideOf()).toBe('none'); // wrapped
  dlg.cycleSelectedFreeze();
  expect(sideOf()).toBe('left'); // and continues
});

// Reorder is a no-op at both boundaries; a middle move shifts the column.
test('reorder is a boundary no-op at the top and bottom, and moves a middle column', () => {
  const { dlg } = open(buildGrid());
  // Top boundary.
  dlg.select(0);
  dlg.reorderSelected(-1);
  expect(dlg.workingColumns()[0].id).toBe('id');
  expect(dlg.selected()).toBe(0); // cursor unchanged on a no-op
  // Bottom boundary.
  const last = dlg.workingColumns().length - 1;
  dlg.select(last);
  dlg.reorderSelected(1);
  expect(dlg.workingColumns().at(-1)!.id).toBe('active');
  expect(dlg.selected()).toBe(last);
  // A valid middle move follows the cursor.
  dlg.select(dlg.indexOf('dept'));
  dlg.reorderSelected(1);
  expect(dlg.workingColumns().map((c) => c.id)).toEqual(['id', 'name', 'total', 'dept', 'note', 'active']);
  expect(dlg.workingColumns()[dlg.selected()].id).toBe('dept'); // cursor moved with it
});

// The body region renders — it does not collapse to width 0 (the all-absolute-children footgun). The
// column titles and the count echo paint.
test('the dialog body renders its column region and count echo (no width collapse)', () => {
  const { loop } = open(buildGrid());
  const screen = painted(loop);
  expect(screen).toContain('Total'); // a column title from the region painted → the body has width
  expect(screen).toContain('columns visible'); // the live echo painted
});

// The visible-count echo reflects the pending visibility as columns are hidden.
test('the visible-count echo tracks the pending visibility', () => {
  const { loop, dlg } = open(buildGrid());
  expect(painted(loop)).toContain('6 of 6 columns visible');
  dlg.select(dlg.indexOf('note'));
  dlg.toggleSelectedVisibility(); // hide one
  loop.renderRoot.flush();
  expect(painted(loop)).toContain('5 of 6 columns visible');
});
