/**
 * Implementation tests — internals and edges of Tab cell-traversal.
 *
 * These cover behaviour beyond the spec oracle: the `commitEdit` seam's idle/idempotent contract, the
 * installer's uninstaller, the multi-grid single-advance-and-single-focus-hop guarantee, and the
 * grid.ts line-count guard. They may evolve with the implementation, unlike the spec oracle.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { installGridNavigation } from '../src/navigation.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false, ...mods };
}

interface Person {
  id: number;
  name: string;
  city: string;
}

function makeGrid() {
  const rows = signal<Person[]>([
    { id: 1, name: 'Ada', city: 'NYC' },
    { id: 2, name: 'Bo', city: 'LA' },
    { id: 3, name: 'Cy', city: 'SF' },
  ]);
  const editable = (id: keyof Person & string, title: string) =>
    column<Person, string>({
      id,
      title,
      value: (r) => String(r[id]),
      parse: (t) => t,
      set: (r, v) => {
        (r[id] as string) = v;
      },
      width: 8,
    });
  const grid = new EditableDataGrid<Person>({
    columns: [editable('name', 'Name'), editable('city', 'City')],
    source: fromRows(rows, { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 30, height: 6 } };
  return { grid, rows };
}

test('commitEdit resolves false when idle, true after an open edit, then idle again', async () => {
  const { grid } = makeGrid();
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 30, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  expect(await grid.rows.commitEdit()).toBe(false); // nothing open
  loop.dispatch(key('Z')); // open an editor (replace-edit)
  expect(grid.rows.isEditing()).toBe(true);
  expect(await grid.rows.commitEdit()).toBe(true); // committed
  expect(grid.rows.isEditing()).toBe(false);
  expect(await grid.rows.commitEdit()).toBe(false); // idle again → false
});

test('the uninstaller unregisters the handlers', async () => {
  const { grid } = makeGrid();
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 30, height: 6 }, { caps });
  loop.mount(root);
  const uninstall = installGridNavigation(loop, grid);
  loop.focusView(grid.rows);
  uninstall();

  loop.emitCommand('grid.nextCell'); // no handler now
  await tick();
  loop.emitCommand('grid.nextCell');
  await tick();
  expect(grid.focusedRow()?.id).toBe(1); // never advanced — the handler is gone
});

test('multi-grid: only the focused grid advances; the other is untouched', async () => {
  const a = makeGrid();
  const b = makeGrid();
  const root = new Group();
  root.add(a.grid);
  root.add(b.grid);
  const loop = createEventLoop({ width: 30, height: 6 }, { caps });
  loop.mount(root);
  const uninstall = installGridNavigation(loop, [a.grid, b.grid]);

  // Only A is focused: two advances take A to row 1 (wrap); B never moves — a single handler pair acts
  // on exactly the focused grid (no double-advance, no cross-grid effect).
  loop.focusView(a.grid.rows);
  loop.emitCommand('grid.nextCell');
  await tick();
  loop.emitCommand('grid.nextCell');
  await tick();
  expect(a.grid.focusedRow()?.id).toBe(2); // A wrapped a row
  expect(b.grid.focusedRow()?.id).toBe(1); // B untouched

  uninstall();
});

test('the Shift-Tab command retreats the cursor (prevCell wraps a row)', async () => {
  const { grid } = makeGrid();
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 30, height: 6 }, { caps });
  loop.mount(root);
  const uninstall = installGridNavigation(loop, grid);
  loop.focusView(grid.rows);

  // Advance two cells: (0,0) → (1,0) → (0,1), landing on row 1.
  loop.emitCommand('grid.nextCell');
  await tick();
  loop.emitCommand('grid.nextCell');
  await tick();
  expect(grid.focusedRow()?.id).toBe(2);

  // prevCell wraps back to (1,0) on row 0.
  loop.emitCommand('grid.prevCell');
  await tick();
  expect(grid.focusedRow()?.id).toBe(1);

  uninstall();
});

test('grid.ts stays under the re-based line-count guard', () => {
  // Re-based 1300 -> 1450 for the RD-12 validation & lifecycle surface: the irreducible public options
  // (`beforeSave`, `validateRow`, `status`, `emptyText`) with their JSDoc, plus the thin
  // isInvalid/activeMessage accessors and the error-registry / message-band / lifecycle wiring. The heavy
  // logic lives in the new modules (error-registry.ts, validation.ts, grid-lifecycle.ts); the guard is
  // NEVER met by re-inlining that logic. See grid-footer.impl.test for the full re-base history.
  const gridSrc = readFileSync(fileURLToPath(new URL('../src/grid.ts', import.meta.url)), 'utf8');
  expect(gridSrc.split('\n').length).toBeLessThan(1450);
});
