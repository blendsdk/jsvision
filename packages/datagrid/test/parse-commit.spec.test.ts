/**
 * Specification test (immutable oracle) — the widened `parse` contract and the commit rejection it
 * enables. An invertible formatter's `parse` may return the `PARSE_FAILED` sentinel; the commit path
 * must treat that as a validation failure: the record is left unchanged (no sentinel / `NaN` written)
 * and the editor stays open so the user can fix the entry.
 *
 * Expectations derive from the requirements — a non-parseable numeric edit is never persisted.
 */
import { test, expect, vi } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fmt } from '../src/format.js';
import { fromRows } from '../src/data-source.js';
import type { OnCommit } from '../src/commit.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const W = 24;
const H = 5;

function key(k: string) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false };
}

interface Account {
  id: number;
  balance: number;
}

// Committing an unparseable string through an invertible currency column is rejected: the record keeps
// its value and the editor stays open.
test('a currency column rejects an unparseable commit, leaving the value unchanged and the editor open', async () => {
  const rows = signal<Account[]>([{ id: 1, balance: 1234.5 }]);
  const spy = vi.fn<OnCommit<Account>>(() => true); // would accept — proving the sentinel is stopped *before* the veto
  const columns = [
    column<Account, number>({
      id: 'balance',
      title: 'Balance',
      value: (r) => r.balance,
      ...fmt.currency({ locale: 'en-US', currency: 'USD' }), // spreads { format, parse } — parse may return PARSE_FAILED
      set: (r, v) => {
        r.balance = v;
      },
      width: 12,
    }),
  ];
  const grid = new EditableDataGrid<Account>({
    columns,
    source: fromRows(rows, { rowKey: (r) => r.id }),
    onCommit: spy,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  loop.dispatch(key('f2')); // begin edit
  const editor = loop.getFocused();
  expect(editor).toBeInstanceOf(Input);
  if (editor instanceof Input) editor.getValueSignal().set('abc'); // an unparseable amount
  loop.dispatch(key('enter')); // attempt to commit
  await tick();
  loop.renderRoot.flush();

  // The unparseable edit is rejected before the veto sink: nothing is written and the editor stays open.
  expect(rows()[0].balance).toBe(1234.5); // value unchanged — no sentinel / NaN persisted
  expect(rows()[0].balance).not.toBeNaN();
  expect(spy).not.toHaveBeenCalled(); // parse failed → the commit never reached onCommit
  expect(loop.getFocused()).toBeInstanceOf(Input); // the editor is still open for a fix
});
