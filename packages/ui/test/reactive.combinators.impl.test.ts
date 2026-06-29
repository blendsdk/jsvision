/**
 * Implementation tests — Reactive core, combinators (internals & edges; 07 §impl).
 *
 * Show's boolean memoization (no rebuild when truthiness holds), For's same-key item refresh
 * without re-render, the empty list, and a removed-then-re-added key getting a fresh scope.
 */
import { test, expect } from 'vitest';
import { signal, createRoot, onCleanup, Show, For } from '../src/reactive/index.js';

test('Show does not rebuild the branch when the condition stays truthy', () => {
  const n = signal(2);
  let builds = 0;
  const view = createRoot(() =>
    Show(
      () => n() > 0,
      () => {
        builds += 1;
        return 'pos';
      },
      () => {
        builds += 1;
        return 'neg';
      },
    ),
  );

  expect(view()).toBe('pos');
  expect(builds).toBe(1);

  n.set(5); // still > 0 → truthiness unchanged → no rebuild
  expect(view()).toBe('pos');
  expect(builds).toBe(1);

  n.set(-1); // flips false → rebuild
  expect(view()).toBe('neg');
  expect(builds).toBe(2);
});

test('For reuses the node for a same-key item change (no re-render)', () => {
  const items = signal([{ id: 1, label: 'a' }]);
  let renders = 0;
  const view = createRoot(() =>
    For(
      () => items(),
      (item) => item.id,
      (item) => {
        renders += 1;
        return { id: item.id };
      },
    ),
  );

  const firstNode = view()[0];
  expect(renders).toBe(1);

  items.set([{ id: 1, label: 'CHANGED' }]); // same key, different item object
  const nextNode = view()[0];
  expect(nextNode).toBe(firstNode); // node instance reused
  expect(renders).toBe(1); // not re-rendered
});

test('For handles an empty list and transitions in and out of empty', () => {
  const items = signal<number[]>([]);
  const view = createRoot(() =>
    For(
      () => items(),
      (n) => n,
      (n) => ({ value: n }),
    ),
  );

  expect(view()).toEqual([]);

  items.set([1, 2]);
  expect(view().map((node) => node.value)).toEqual([1, 2]);

  items.set([]);
  expect(view()).toEqual([]);
});

test('For gives a removed-then-re-added key a fresh scope and node', () => {
  const items = signal([{ id: 1 }]);
  let creates = 0;
  let disposes = 0;
  const view = createRoot(() =>
    For(
      () => items(),
      (item) => item.id,
      (item) => {
        creates += 1;
        onCleanup(() => {
          disposes += 1;
        });
        return { id: item.id };
      },
    ),
  );

  const firstNode = view()[0];
  expect(creates).toBe(1);

  items.set([]); // remove id 1 → its scope disposes
  expect(view()).toEqual([]);
  expect(disposes).toBe(1);

  items.set([{ id: 1 }]); // re-add id 1 → fresh render + scope
  const secondNode = view()[0];
  expect(creates).toBe(2);
  expect(secondNode).not.toBe(firstNode);
});
