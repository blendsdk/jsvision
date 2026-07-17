/**
 * Implementation tests — internals and edges of the body's chord→action dispatch.
 *
 * These cover behaviour beyond the spec oracle: the router delegating cross-panel cursor moves through
 * the existing `setGlobalCol` hop, base-delegated paging (including the Ctrl+Page fall-through the keymap
 * does not bind), the edit-vs-select precedence on Space, and full nav remappability. They may evolve
 * with the implementation, unlike the spec oracle.
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { DispatchEvent } from '@jsvision/ui';
import { column, toEngineColumn } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { mergeKeymap } from '../src/keymap.js';
import type { GridKeymap } from '../src/keymap.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false, ...mods };
}

interface Person {
  id: number;
  name: string;
}
const NAME = column<Person, string>({
  id: 'name',
  title: 'Name',
  value: (r) => r.name,
  parse: (t) => t,
  set: (r, v) => {
    r.name = v;
  },
  width: 8,
});
const ID = column<Person, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 6 });

interface BuildOpts {
  keymap?: GridKeymap;
  columns?: GridColumn<Person>[];
  columnOffset?: number;
  totalCols?: number;
  onCursorEnterPanel?: (g: number, ev: DispatchEvent) => void;
  wireToggle?: boolean;
}

function build(opts: BuildOpts = {}) {
  const rows: Person[] = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `n${i + 1}` }));
  const typedColumns = opts.columns ?? [NAME, ID];
  const engineCols = typedColumns.map(toEngineColumn);
  const focused = signal(0);
  const focusedCol = signal(0);
  const selected = signal(-1);
  const indent = signal(0);
  const version = signal(0);
  const overlay = new Group();
  overlay.layout = { position: 'fill' };
  const toggled: number[] = [];
  const grid = new EditableGridRows<Person>({
    display: () => {
      version();
      return rows;
    },
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent,
    focused,
    selected,
    zebra: false,
    focusedCol,
    typedColumns,
    overlay,
    rowKey: (r) => r.id,
    bumpVersion: () => version.set(version() + 1),
    onToggleRow: opts.wireToggle === false ? undefined : (i) => toggled.push(i),
    columnOffset: opts.columnOffset,
    totalCols: opts.totalCols !== undefined ? () => opts.totalCols! : undefined,
    onCursorEnterPanel: opts.onCursorEnterPanel,
    keymap: opts.keymap,
  });
  grid.layout = { position: 'fill' };
  const container = new Group();
  container.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 24, height: 6 } };
  container.add(grid);
  container.add(overlay);
  const root = new Group();
  root.add(container);
  const loop = createEventLoop({ width: 24, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(grid);
  return { grid, loop, overlay, focused, focusedCol, toggled };
}

test('the router hops the cursor across a panel boundary via setGlobalCol', () => {
  const hops: number[] = [];
  // A one-column panel (owns global col 0) inside a three-column grid; moveRight lands the cursor in
  // the next panel, so the panel asks the container to re-focus the owner.
  const g = build({
    columns: [NAME],
    columnOffset: 0,
    totalCols: 3,
    onCursorEnterPanel: (globalCol) => hops.push(globalCol),
  });
  g.loop.dispatch(key('right')); // moveRight → setGlobalCol(1) → outside this panel → hop
  expect(g.focusedCol()).toBe(1);
  expect(hops).toEqual([1]);
});

test('edit-before-select precedence on Space: editable edits, read-only toggles', () => {
  const g = build();
  g.loop.dispatch(key('space')); // editable Name cell → replace-edit, no toggle
  expect(g.overlay.children.length).toBe(1);
  expect(g.toggled).toEqual([]);
  g.loop.dispatch(key('escape'));

  g.loop.dispatch(key('right')); // read-only ID cell → Space toggles
  g.loop.dispatch(key('space'));
  expect(g.toggled).toEqual([0]);
});

test('Enter edits an editable cell but activates a read-only one', () => {
  const g = build();
  g.loop.dispatch(key('enter')); // editable → editor
  expect(g.overlay.children.length).toBe(1);
  expect(g.loop.getFocused()).toBeInstanceOf(Input);
  g.loop.dispatch(key('escape'));
  g.loop.dispatch(key('right'));
  g.loop.dispatch(key('enter')); // read-only → base activate, no editor
  expect(g.overlay.children.length).toBe(0);
});

test('paging delegates to the base; Ctrl+PageUp/Down fall through to the base jump', () => {
  const g = build();
  g.focused.set(11); // last row
  g.loop.dispatch(key('pageup')); // pageUp → base focusBy(-viewportRows) — moves up a page
  expect(g.focused()).toBeLessThan(11);

  g.focused.set(5);
  g.loop.dispatch(key('pageup', { ctrl: true })); // not in the keymap → base handleKey → focusTo(0)
  expect(g.focused()).toBe(0);
  g.loop.dispatch(key('pagedown', { ctrl: true })); // → base focusTo(last)
  expect(g.focused()).toBe(11);
});

test('navigation is fully remappable: a caller chord drives moveDown', () => {
  const g = build({ keymap: mergeKeymap({ 'ctrl+d': 'moveDown' }) });
  g.loop.dispatch(key('d', { ctrl: true }));
  expect(g.focused()).toBe(1); // Ctrl+D moved the row cursor down
});

test('a read-only body without a toggle sink lets Space fall through without throwing', () => {
  const g = build({ columns: [ID], wireToggle: false });
  expect(() => g.loop.dispatch(key('space'))).not.toThrow();
  expect(g.overlay.children.length).toBe(0); // no editor (read-only), no toggle sink → base activate
});
