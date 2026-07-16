/**
 * Specification tests (immutable oracles) — the per-column null policy (RD-08 Phase 5; plan doc
 * plans/rows-selection/03-05, 07-testing-strategy ST-19 … ST-20).
 *
 * A `nullable` column can hold and display `null` distinctly from an empty string: a null value renders
 * the column's `nullDisplay` (default `''`, never the literal `"null"`), and an editor that commits an
 * empty value stores `null` (bypassing `parse`). A non-nullable column is unchanged — an empty commit
 * parses `''` as before (text → `''`, numeric → rejected).
 *
 * Expectations derive from the requirements, never the implementation. Screen coords are 0-based; the
 * header sits at row 0, so body display row `r` renders at row `r + 1`.
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 20;
const H = 6;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function key(k: string) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false };
}

interface Emp {
  id: number;
  dept: string | null;
}

/** Read `len` characters starting at (x, y) from the frame. */
function text(loop: ReturnType<typeof createEventLoop>, x: number, y: number, len: number): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let i = 0; i < len; i += 1) s += buf.get(x + i, y)?.char ?? ' ';
  return s;
}

// ST-19 — a null value renders `nullDisplay`, distinct from an empty string (which renders blank) and
// never the literal `"null"`; a real value is unaffected.
test('ST-19: a null value renders nullDisplay, distinct from an empty string', () => {
  const rows = signal<Emp[]>([
    { id: 1, dept: null }, // renders nullDisplay
    { id: 2, dept: '' }, // renders blank (empty string)
    { id: 3, dept: 'Ops' }, // renders the value
  ]);
  const grid = new EditableDataGrid<Emp>({
    columns: [
      column<Emp, string | null>({
        id: 'dept',
        title: 'Dept',
        value: (r) => r.dept,
        parse: (t) => t,
        set: (r, v) => {
          r.dept = v;
        },
        nullable: true,
        nullDisplay: '-',
        width: 12,
      }),
    ],
    source: fromRows(rows, { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();

  expect(text(loop, 0, 1, 3)).toBe('-  '); // null → nullDisplay '-' (left-aligned, padded), NOT "null"
  expect(text(loop, 0, 2, 3)).toBe('   '); // '' → blank, distinct from the null row above
  expect(text(loop, 0, 3, 3)).toBe('Ops'); // a real value renders as before
});

// ST-20 — an empty editor commit stores `null` on a `nullable` column and `''` on a non-nullable one.
test('ST-20: an empty commit stores null on a nullable column and "" on a non-nullable one', async () => {
  // Nullable column: clearing the cell to empty commits null (distinct from '').
  const rows = signal<Emp[]>([{ id: 1, dept: 'Ops' }]);
  const grid = new EditableDataGrid<Emp>({
    columns: [
      column<Emp, string | null>({
        id: 'dept',
        title: 'Dept',
        value: (r) => r.dept,
        parse: (t) => t,
        set: (r, v) => {
          r.dept = v;
        },
        nullable: true,
        nullDisplay: '-',
        width: 12,
      }),
    ],
    source: fromRows(rows, { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set(''); // clear the cell
  loop.dispatch(key('enter'));
  await tick();
  expect(rows()[0].dept).toBeNull(); // empty commit on a nullable column → null

  // Non-nullable text column: the same empty commit stores '' (not null).
  interface Person {
    id: number;
    name: string;
  }
  const people = signal<Person[]>([{ id: 1, name: 'Ada' }]);
  const grid2 = new EditableDataGrid<Person>({
    columns: [
      column<Person, string>({
        id: 'name',
        title: 'Name',
        value: (r) => r.name,
        parse: (t) => t,
        set: (r, v) => {
          r.name = v;
        },
        width: 12,
      }),
    ],
    source: fromRows(people, { rowKey: (r) => r.id }),
  });
  grid2.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root2 = new Group();
  root2.add(grid2);
  const loop2 = createEventLoop({ width: W, height: H }, { caps });
  loop2.mount(root2);
  loop2.focusView(grid2.rows);

  loop2.dispatch(key('f2'));
  const editor2 = loop2.getFocused();
  if (editor2 instanceof Input) editor2.getValueSignal().set('');
  loop2.dispatch(key('enter'));
  await tick();
  expect(people()[0].name).toBe(''); // empty commit on a non-nullable column → '' (not null)
});
