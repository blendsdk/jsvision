/**
 * Specification tests (immutable oracles) — dirty tracking (ST-8). A cell is dirty while its commit is
 * pending: the reactive registry reports it across a deferred async `onCommit` and clears on resolve,
 * and the body overpaints a `•` in the `gridDirty` foreground for any cell in the registry.
 *
 * Expectations derive from the requirements + the frozen `gridDirty` role, never the implementation.
 */
import { test, expect, vi } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { column, toEngineColumn } from '../src/column.js';
import type { OnCommit } from '../src/commit.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { createDirtyRegistry, cellKey } from '../src/editing.js';
import type { DirtyRegistry } from '../src/editing.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

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
  width: 10,
});

const W = 14;
const H = 5;
/** The dirty marker sits at the right edge of column 0 (width 10, no indent). */
const MARKER_X = 9;

function build(opts: { onCommit?: OnCommit<Person>; dirty?: DirtyRegistry } = {}) {
  const rows: Person[] = [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Bo' },
  ];
  const typedColumns = [NAME];
  const engineCols = typedColumns.map(toEngineColumn);
  const version = signal(0);
  const overlay = new Group();
  overlay.setLayout({ position: 'fill' });
  const grid = new EditableGridRows<Person>({
    display: () => {
      version();
      return rows;
    },
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent: signal(0),
    focused: signal(0),
    selected: signal(-1),
    zebra: false,
    focusedCol: signal(0),
    typedColumns,
    overlay,
    onCommit: opts.onCommit,
    rowKey: (r) => r.id,
    bumpVersion: () => version.set(version() + 1),
    dirty: opts.dirty,
  });
  grid.setLayout({ position: 'fill' });
  const container = new Group();
  container.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  container.add(grid);
  container.add(overlay);
  const root = new Group();
  root.add(container);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid);
  return { grid, loop, rows };
}

function deferredCommit(): { spy: OnCommit<Person>; resolve: (v: boolean) => void } {
  let resolve!: (v: boolean) => void;
  const promise = new Promise<boolean>((r) => {
    resolve = r;
  });
  return { spy: vi.fn<OnCommit<Person>>(() => promise), resolve };
}

// ST-8 — the cell is dirty while its async commit is pending and clean once it resolves.
test('ST-8: a cell is dirty across a pending async commit and clears on resolve', async () => {
  const registry = createDirtyRegistry();
  const { spy, resolve } = deferredCommit();
  const { loop } = build({ onCommit: spy, dirty: registry });
  const ck = cellKey(1, 'name');
  expect(registry.has(ck)).toBe(false);
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('X');
  loop.dispatch(key('enter'));
  await tick();
  expect(registry.has(ck)).toBe(true); // pending
  resolve(true);
  await tick();
  expect(registry.has(ck)).toBe(false); // cleared once the source reflects the value
});

// ST-8 — the body overpaints a `•` in the gridDirty foreground for a cell in the registry.
test('ST-8: the body paints a dirty marker in gridDirty for a registry cell', () => {
  const registry = createDirtyRegistry();
  const { loop } = build({ dirty: registry });
  registry.add(cellKey(1, 'name')); // row 0 (id 1), column 'name'
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  expect(buf.get(MARKER_X, 0)?.char).toBe('•');
  expect(buf.get(MARKER_X, 0)?.fg).toBe(defaultTheme.gridDirty.fg);
});
