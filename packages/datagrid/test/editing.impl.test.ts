/**
 * Implementation tests — the editing lifecycle internals: a vetoed commit keeps the field for
 * re-editing, a commit repaints the mutated-in-place row via the container version bump, the per-cell
 * `committing` guard serializes overlapping commits (ST-14), and — the risk flagged during preflight
 * (PF-005) — a *deferred* async commit still flushes its post-resolve repaint + refocus headlessly.
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

function build(opts: { onCommit?: OnCommit<Person> } = {}) {
  const rows: Person[] = [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Bo' },
  ];
  const typedColumns = [NAME];
  const engineCols = typedColumns.map(toEngineColumn);
  const focused = signal(0);
  const focusedCol = signal(0);
  const selected = signal(-1);
  const indent = signal(0);
  const version = signal(0);
  const overlay = new Group();
  overlay.layout = { position: 'fill' };
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
  grid.layout = { position: 'fill' };
  const container = new Group();
  container.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  container.add(grid);
  container.add(overlay);
  const root = new Group();
  root.add(container);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid);
  return { grid, loop, rows, focused };
}

/** The characters painted on screen row `y`. */
function frameRow(loop: ReturnType<typeof build>['loop'], y: number): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

/** A promise-returning onCommit whose resolution is controlled by the test. */
function deferredCommit(): { spy: OnCommit<Person>; resolve: (v: boolean) => void } {
  let resolve!: (v: boolean) => void;
  const promise = new Promise<boolean>((r) => {
    resolve = r;
  });
  return { spy: vi.fn<OnCommit<Person>>(() => promise), resolve };
}

// A vetoed commit keeps the editor open with the user's text intact so they can fix it.
test('a vetoed commit keeps the editor open with the field preserved for re-editing', async () => {
  const { loop } = build({ onCommit: () => false });
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('bad');
  loop.dispatch(key('enter'));
  await tick();
  const still = loop.getFocused();
  expect(still).toBeInstanceOf(Input); // editor remained open
  if (still instanceof Input) expect(still.getValueSignal()()).toBe('bad'); // field preserved
});

// A committed edit mutates the row in place; the container version bump forces the repaint.
test('a commit repaints the mutated-in-place row via the version bump', async () => {
  const { loop, rows } = build(); // no onCommit → commits
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('Zed');
  loop.dispatch(key('enter'));
  await tick();
  loop.renderRoot.flush();
  expect(rows[0].name).toBe('Zed');
  expect(frameRow(loop, 0)).toContain('Zed'); // the repainted (now unfocused) row 0
});

// ST-14 — a second commit on the same cell while the first is in flight is serialized (no overlap).
test('ST-14: a second commit on the same cell while one is in flight is serialized', async () => {
  const { spy, resolve } = deferredCommit();
  const { loop, rows } = build({ onCommit: spy });
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('One');
  loop.dispatch(key('enter')); // commit 1 starts; onCommit is pending
  await tick();
  loop.dispatch(key('enter')); // a second Enter while pending — the guard blocks it
  await tick();
  expect(spy).toHaveBeenCalledTimes(1); // only one commit ran
  resolve(true);
  await tick();
  expect(rows[0].name).toBe('One');
});

// PF-005 — a deferred async commit stays open while pending, then flushes its repaint + refocus on
// resolve, headlessly (no live TTY).
test('PF-005: a deferred async commit flushes the repaint and refocus on resolve', async () => {
  const { spy, resolve } = deferredCommit();
  const { grid, loop, rows, focused } = build({ onCommit: spy });
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('Zed');
  loop.dispatch(key('enter'));
  await tick();
  expect(loop.getFocused()).toBeInstanceOf(Input); // still open while pending (await-close)
  expect(rows[0].name).toBe('Zed'); // optimistic write already applied
  resolve(true);
  await tick();
  loop.renderRoot.flush();
  expect(loop.getFocused()).toBe(grid); // body refocused after the async resolve
  expect(focused()).toBe(1); // advanced to the next row
  expect(frameRow(loop, 0)).toContain('Zed'); // committed value repainted
});

// F4 begins the edit on any editable cell; its `openDropdown` flag only opens a dropdown for a
// value-help ComboBox editor. On a non-ComboBox editor (here a text Input; a DatePicker behaves the
// same) the open forward is guarded away — the editor just mounts and focuses, and nothing throws.
test('F4 begins the edit on a non-lookup cell and openDropdown is inert', () => {
  const { grid, loop } = build();
  expect(() => loop.dispatch(key('f4'))).not.toThrow();
  const editor = loop.getFocused();
  expect(editor).toBeInstanceOf(Input); // the text editor mounted and took focus (begin-edit)
  expect(editor).not.toBe(grid);
  // Typing lands in the mounted editor — proof it is a live begin-edit, not a swallowed key.
  if (editor instanceof Input) {
    loop.dispatch(key('x'));
    expect(editor.getValueSignal()()).toContain('x');
  }
});
