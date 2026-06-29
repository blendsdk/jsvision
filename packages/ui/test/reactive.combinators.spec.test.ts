/**
 * Specification tests (immutable oracles) — Reactive core, structural combinators.
 *
 * Source: RD-01 AC-12, AC-13, AC-19, AC-20 → ST-12, ST-13, ST-19, ST-20
 * (plans/reactive-core/07-testing-strategy.md). Both combinators are UI-independent: generic
 * over the rendered child type and returning a reactive accessor. Expectations derive from the
 * acceptance criteria, never from the implementation.
 */
import { test, expect, vi } from 'vitest';
import { signal, effect, createRoot, onCleanup, Show, For } from '../src/reactive/index.js';

// ST-12 / AC-12 — Show yields the active branch; flipping disposes the previous branch scope
// (its onCleanup fires exactly once), and a missing else yields undefined.
test('ST-12: Show mounts one branch and disposes the previous on flip (onCleanup once)', () => {
  const cond = signal(true);
  let aCleanups = 0;
  let bCleanups = 0;

  const view = createRoot(() =>
    Show(
      () => cond(),
      () => {
        onCleanup(() => {
          aCleanups += 1;
        });
        return 'A';
      },
      () => {
        onCleanup(() => {
          bCleanups += 1;
        });
        return 'B';
      },
    ),
  );

  expect(view()).toBe('A');

  cond.set(false);
  expect(view()).toBe('B'); // flipped to the else branch
  expect(aCleanups).toBe(1); // A's scope disposed exactly once

  cond.set(true);
  expect(view()).toBe('A');
  expect(bCleanups).toBe(1); // B's scope disposed exactly once
});

test('ST-12: Show with no else yields undefined while the condition is false', () => {
  const cond = signal(false);
  const view = createRoot(() =>
    Show(
      () => cond(),
      () => 'X',
    ),
  );

  expect(view()).toBeUndefined();
  cond.set(true);
  expect(view()).toBe('X');
});

// ST-13 / AC-13 — For renders once per distinct key; reorder reuses node instances (0 extra
// renders) and preserves items order; removing a key disposes its scope (onCleanup fires).
test('ST-13: For keyed reuse — render once per key, reorder reuses, removal disposes', () => {
  type Item = { id: number; label: string };
  const items = signal<Item[]>([
    { id: 1, label: 'a' },
    { id: 2, label: 'b' },
    { id: 3, label: 'c' },
  ]);
  let disposed = 0;
  const renderSpy = vi.fn((item: Item) => {
    onCleanup(() => {
      disposed += 1;
    });
    return { id: item.id };
  });

  const view = createRoot(() =>
    For(
      () => items(),
      (item) => item.id,
      renderSpy,
    ),
  );

  const first = view();
  expect(first.map((n) => n.id)).toEqual([1, 2, 3]);
  expect(renderSpy).toHaveBeenCalledTimes(3);

  // Reorder to a permutation of the same keys.
  items.set([
    { id: 3, label: 'c' },
    { id: 1, label: 'a' },
    { id: 2, label: 'b' },
  ]);
  const reordered = view();
  expect(reordered.map((n) => n.id)).toEqual([3, 1, 2]); // output order matches items
  expect(renderSpy).toHaveBeenCalledTimes(3); // 0 extra render calls
  expect(reordered[1]).toBe(first[0]); // id 1's node instance reused (moved 0 → 1)
  expect(disposed).toBe(0); // nothing removed yet

  // Remove id 2.
  items.set([
    { id: 3, label: 'c' },
    { id: 1, label: 'a' },
  ]);
  const removed = view();
  expect(removed.map((n) => n.id)).toEqual([3, 1]);
  expect(renderSpy).toHaveBeenCalledTimes(3); // still no new renders
  expect(disposed).toBe(1); // id 2's scope disposed (its onCleanup fired)
});

// ST-19 / AC-19 — reordering updates each surviving item's reactive index().
test('ST-19: For reorder updates the reactive index observed by an item effect', () => {
  const items = signal<Array<{ id: string }>>([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const indexLog: Record<string, number[]> = { a: [], b: [], c: [] };

  const view = createRoot(() =>
    For(
      () => items(),
      (item) => item.id,
      (item, index) => {
        effect(() => {
          indexLog[item.id].push(index());
        });
        return item.id;
      },
    ),
  );
  view(); // drive the initial render

  expect(indexLog.a).toEqual([0]);
  expect(indexLog.b).toEqual([1]);
  expect(indexLog.c).toEqual([2]);

  // Move 'a' to the end: a:0→2, b:1→0, c:2→1.
  items.set([{ id: 'b' }, { id: 'c' }, { id: 'a' }]);
  view();

  expect(indexLog.a).toEqual([0, 2]); // a's effect re-ran with its new index
  expect(indexLog.b).toEqual([1, 0]);
  expect(indexLog.c).toEqual([2, 1]);
});

// ST-20 / AC-20 — duplicate live keys dev-warn and do not crash (last-writer-wins); the output
// length equals items.length with the surviving node repeated at each position holding that key.
test('ST-20: For duplicate keys dev-warn, last-writer-wins, output length === items.length', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const items = signal([
      { id: 1, v: 'x' },
      { id: 1, v: 'y' }, // duplicate key 1
      { id: 2, v: 'z' },
    ]);
    const view = createRoot(() =>
      For(
        () => items(),
        (item) => item.id,
        (item) => ({ id: item.id }),
      ),
    );

    const nodes = view();

    expect(warnSpy).toHaveBeenCalled(); // dev warning for the duplicate key
    expect(nodes.length).toBe(3); // length === items.length (PA-6)
    expect(nodes[0]).toBe(nodes[1]); // duplicate node repeated at both positions
    expect(nodes[2].id).toBe(2);
  } finally {
    process.env.NODE_ENV = previousEnv;
    warnSpy.mockRestore();
  }
});
