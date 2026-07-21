/**
 * Specification tests (immutable oracles) — the in-cell editing lifecycle (ST-1…ST-6, ST-9). Begin-edit
 * (F2 / Enter / printable) mounts a focused editor over an editable cell and is a no-op on a read-only
 * one; a printable replaces the cell content; Enter commits through the `onCommit` veto and advances to
 * the next row; Esc reverts and closes without `onCommit`; a vetoed commit keeps the editor open and
 * reverts the record; the overlay is a single cell and is disposed on close.
 *
 * Expectations derive from the requirements, never the implementation. Commit is await-close (async),
 * so a committing dispatch is followed by a macrotask `tick()` before asserting.
 */
import { test, expect, vi } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column, toEngineColumn } from '../src/column.js';
import type { OnCommit } from '../src/commit.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Drain the microtasks a deferred (await-close) commit schedules. */
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false, ...mods };
}

interface Person {
  id: number;
  name: string;
}

/** col 0 = editable Name, col 1 = read-only ID. */
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

const W = 20;
const H = 5;

function build(opts: { onCommit?: OnCommit<Person> } = {}) {
  const rows: Person[] = [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Bo' },
    { id: 3, name: 'Cy' },
  ];
  const typedColumns = [NAME, ID];
  const engineCols = typedColumns.map(toEngineColumn);
  const focused = signal(0);
  const focusedCol = signal(0);
  const selected = signal(-1);
  const indent = signal(0);
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
    indent,
    focused,
    selected,
    zebra: false,
    focusedCol,
    typedColumns,
    overlay,
    onCommit: opts.onCommit,
    rowKey: (r) => r.id,
    bumpVersion: () => version.set(version() + 1),
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
  return { grid, loop, overlay, rows, focused, focusedCol };
}

/** Read the current editor's bound field value (the editor is the focused Input). */
function fieldValue(loop: ReturnType<typeof build>['loop']): string {
  const editor = loop.getFocused();
  expect(editor).toBeInstanceOf(Input);
  return editor instanceof Input ? editor.getValueSignal()() : '';
}

// ST-1 — begin-edit on a read-only cell is a no-op: no editor mounts, the record is untouched.
test('ST-1: Enter and F2 on a read-only cell mount no editor and leave the record untouched', () => {
  const { grid, loop, overlay, rows } = build();
  loop.dispatch(key('right')); // move to the read-only ID column
  loop.dispatch(key('enter'));
  expect(loop.getFocused()).toBe(grid); // no editor took focus
  expect(overlay.children.length).toBe(0);
  loop.dispatch(key('f2'));
  expect(loop.getFocused()).toBe(grid);
  expect(overlay.children.length).toBe(0);
  expect(rows[0]).toEqual({ id: 1, name: 'Ada' }); // untouched
});

// ST-2 — begin-edit on an editable cell mounts an editor and moves focus to it.
test('ST-2: Enter on an editable cell mounts an editor and focuses it', () => {
  const { grid, loop, overlay } = build();
  loop.dispatch(key('enter'));
  expect(loop.getFocused()).toBeInstanceOf(Input);
  expect(loop.getFocused()).not.toBe(grid);
  expect(overlay.children.length).toBe(1);
});

test('ST-2: F2 on an editable cell also mounts an editor and focuses it', () => {
  const { loop, overlay } = build();
  loop.dispatch(key('f2'));
  expect(loop.getFocused()).toBeInstanceOf(Input);
  expect(overlay.children.length).toBe(1);
});

// ST-3 — a printable begin-edit replaces the cell content with the typed character.
test('ST-3: a printable begin-edit seeds the field with the typed char (content replaced)', () => {
  const { loop } = build();
  loop.dispatch(key('x'));
  expect(fieldValue(loop)).toBe('x'); // replaced, not 'Adax'
});

// ST-4 — while editing, a printable lands in the editor and the cursor does not move; Enter commits
// and advances to the next row, same column.
test('ST-4: keys route to the editor; Enter commits and advances to the next row', async () => {
  const { grid, loop, focused, focusedCol } = build();
  loop.dispatch(key('f2')); // begin edit on row 0 / col 0
  loop.dispatch(key('Z')); // a printable while editing
  expect(fieldValue(loop)).toContain('Z'); // it landed in the editor
  expect(focusedCol()).toBe(0); // the grid cursor did not move
  expect(focused()).toBe(0);
  loop.dispatch(key('enter'));
  await tick();
  expect(focused()).toBe(1); // advanced one row
  expect(focusedCol()).toBe(0); // same column
  expect(loop.getFocused()).toBe(grid); // body refocused
});

// ST-5 — Esc reverts and closes without calling onCommit.
test('ST-5: Esc reverts, closes the editor, and does not call onCommit', async () => {
  const spy = vi.fn<OnCommit<Person>>(() => true);
  const { grid, loop, overlay, rows } = build({ onCommit: spy });
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('ZZ');
  loop.dispatch(key('escape'));
  await tick();
  expect(rows[0].name).toBe('Ada'); // never written to the record
  expect(spy).not.toHaveBeenCalled();
  expect(loop.getFocused()).toBe(grid);
  expect(overlay.children.length).toBe(0);
});

// ST-6 — onCommit is called exactly once with the change payload; true closes with the new value.
test('ST-6: onCommit is called once with the payload and true commits + closes', async () => {
  const spy = vi.fn<OnCommit<Person>>(() => true);
  const { loop, overlay, rows } = build({ onCommit: spy });
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('Bo');
  loop.dispatch(key('enter'));
  await tick();
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({ rowKey: 1, columnId: 'name', value: 'Bo', previous: 'Ada' }),
  );
  expect(rows[0].name).toBe('Bo'); // committed
  expect(overlay.children.length).toBe(0); // closed
});

// ST-6 — a false onCommit keeps the editor open and reverts the record to the previous value.
test('ST-6: a false onCommit keeps the editor open and reverts the record', async () => {
  const spy = vi.fn<OnCommit<Person>>(() => false);
  const { loop, rows } = build({ onCommit: spy });
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('Cy');
  loop.dispatch(key('enter'));
  await tick();
  expect(spy).toHaveBeenCalledTimes(1);
  expect(loop.getFocused()).toBeInstanceOf(Input); // editor remains open + focused
  expect(rows[0].name).toBe('Ada'); // reverted by commitCell
});

// ST-9 — the editor overlay is a single cell, and closing it disposes the overlay child.
test('ST-9: the editor overlay is one cell and is disposed on close', async () => {
  const { loop, overlay } = build(); // editable col 0
  loop.dispatch(key('f2'));
  expect(overlay.children.length).toBe(1);
  const editorHost = overlay.children[0];
  expect(editorHost.bounds.height).toBe(1); // one row tall
  expect(editorHost.bounds.width).toBeGreaterThan(0);
  expect(editorHost.bounds.width).toBeLessThanOrEqual(W); // within a single cell's width
  loop.dispatch(key('escape')); // close
  await tick();
  expect(overlay.children.length).toBe(0); // owner disposed — the overlay child is gone
});
