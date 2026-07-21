/**
 * Implementation / edge tests — row-family double-click activation (double-click-activation 03-02).
 *
 * Complements the ST oracles in `multiclick.consumers.spec.test.ts`: only `clickCount === 2`
 * activates (a 3rd same-cell down does NOT re-fire), and a single click's focus+select is intact. Per
 * AR-14 these bare widget tests set `ev.clickCount` directly on a hand-built envelope. `.js` per
 * NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import type { DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { ListView } from '../src/list/index.js';
import { DataGrid } from '../src/table/index.js';
import type { Column } from '../src/table/index.js';
import { Tree } from '../src/tree/index.js';
import type { TreeNode } from '../src/tree/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A bare mouse-down envelope carrying a chosen `clickCount`, with an emit spy. */
function downEnvelope(local: { x: number; y: number }, clickCount: number, emits: string[]): DispatchEvent {
  return {
    event: { type: 'mouse', kind: 'down', button: 0, x: 1, y: 1 },
    handled: false,
    local,
    clickCount,
    emit: (command: string) => emits.push(command),
  };
}

function node<T>(value: T, children: TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}

// ── ListRows ──────────────────────────────────────────────────────────────────────────────────────
test('ListRows: clickCount 1 focuses+selects only; 2 activates; 3 does not re-fire', () => {
  const focused = signal(0);
  const selected = signal(-1);
  const picks: number[] = [];
  const list = new ListView<string>({
    items: signal(['A', 'B', 'C']),
    getText: (s) => s,
    focused,
    selected,
    command: 'go',
    onSelect: (i) => picks.push(i),
  });
  list.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 16, height: 6 } });
  const root = new Group();
  root.add(list);
  const loop = createEventLoop({ width: 16, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(list.rows);
  const emits: string[] = [];

  list.rows.onEvent(downEnvelope({ x: 0, y: 0 }, 1, emits)); // single click row 0
  expect(focused()).toBe(0);
  expect(selected()).toBe(0);
  expect(picks).toEqual([]); // no activation
  expect(emits).toEqual([]);

  list.rows.onEvent(downEnvelope({ x: 0, y: 1 }, 2, emits)); // double click row 1 → activate
  expect(picks).toEqual([1]);
  expect(emits).toEqual(['go']);

  list.rows.onEvent(downEnvelope({ x: 0, y: 1 }, 3, emits)); // 3rd down → NO re-fire
  expect(picks).toEqual([1]);
  expect(emits).toEqual(['go']);
});

// ── GridRows (DataGrid) ─────────────────────────────────────────────────────────────────────────
test('GridRows: only clickCount 2 activates; 1 and 3 do not', () => {
  interface Row {
    name: string;
  }
  const focused = signal(0);
  const picks: number[] = [];
  const columns: Column<Row>[] = [{ title: 'Name', accessor: (r) => r.name, width: '1fr' }];
  const grid = new DataGrid<Row>({
    rows: signal([{ name: 'r0' }, { name: 'r1' }, { name: 'r2' }]),
    columns,
    focused,
    command: 'go',
    onSelect: (i) => picks.push(i),
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 16, height: 8 } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 16, height: 8 }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  const emits: string[] = [];

  grid.rows.onEvent(downEnvelope({ x: 0, y: 0 }, 1, emits)); // single
  expect(picks).toEqual([]);
  grid.rows.onEvent(downEnvelope({ x: 0, y: 0 }, 2, emits)); // double → activate
  expect(picks).toEqual([0]);
  grid.rows.onEvent(downEnvelope({ x: 0, y: 0 }, 3, emits)); // triple → no re-fire
  expect(picks).toEqual([0]);
  expect(emits).toEqual(['go']);
});

// ── TreeRows ──────────────────────────────────────────────────────────────────────────────────────
test('TreeRows: text clickCount 1 focuses only; 3 does not activate; 2 does', () => {
  const focused = signal(0);
  const selected = signal(-1);
  const roots = signal<TreeNode<string>[]>([node('A', [node('A1')])]);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, selected, command: 'go' });
  tree.expand(roots()[0]); // [A, A1]
  tree.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 8 } });
  const root = new Group();
  root.add(tree);
  const loop = createEventLoop({ width: 20, height: 8 }, { caps });
  loop.mount(root);
  loop.focusView(tree.rows);
  const emits: string[] = [];

  // A1 text at local x=6 (level 1, graphWidth(1)=6); row 1.
  tree.rows.onEvent(downEnvelope({ x: 6, y: 1 }, 1, emits)); // single text → focus only
  expect(focused()).toBe(1);
  expect(selected()).toBe(-1);
  expect(emits).toEqual([]);

  tree.rows.onEvent(downEnvelope({ x: 6, y: 1 }, 3, emits)); // triple text → no activate (only ===2)
  expect(selected()).toBe(-1);
  expect(emits).toEqual([]);

  tree.rows.onEvent(downEnvelope({ x: 6, y: 1 }, 2, emits)); // double text → activate
  expect(selected()).toBe(1);
  expect(emits).toEqual(['go']);
});
