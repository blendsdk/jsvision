/**
 * Specification test (immutable oracle) — dynamic children via Show/For (N = View).
 *
 * Source: RD-03 AC-12 → ST-12
 * (codeops/features/jsvision-ui/plans/view-group-spine/07-testing-strategy.md).
 * Reuses RD-01's Show/For with no parallel reconciler; a Group.addDynamic(producer) registers the
 * accessor and mounts/unmounts the produced views. Expectations derive from the AC, never the impl.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { signal, Show, For } from '../src/reactive/index.js';
import { View, Group, createRenderRoot } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

class Leaf extends View {
  draw(): void {
    // no-op
  }
}

// ST-12 / AC-12 — Show<View> mounts/unmounts a view subtree in a Group; the unmounted view's
// onCleanup fires.
test('ST-12: Show<View> mounts/unmounts a child in a Group and runs its onCleanup', () => {
  const shown = signal(true);
  const a = new Leaf();
  let cleanups = 0;
  a.onMount(() => {
    a.onCleanup(() => {
      cleanups += 1;
    });
  });

  const root = new Group();
  root.layout = { direction: 'col' };
  root.addDynamic(
    Show(
      () => shown(),
      () => a,
    ),
  );

  const rr = createRenderRoot({ width: 10, height: 5 }, { caps });
  rr.mount(root);
  expect(root.children).toContain(a); // mounted as a dynamic child
  expect(a.mounted).toBe(true);

  shown.set(false); // Show → undefined → the Group unmounts a
  expect(root.children).not.toContain(a);
  expect(cleanups).toBe(1); // onCleanup fired on unmount

  shown.set(true); // Show → a again → remounted
  expect(root.children).toContain(a);
});

// ST-12 / AC-12 — For<T, View> mounts/unmounts keyed view subtrees; dropping an item removes it.
test('ST-12: For<T, View> reconciles keyed children in a Group', () => {
  const items = signal<number[]>([1, 2, 3]);
  const made = new Map<number, Leaf>();

  const root = new Group();
  root.layout = { direction: 'col' };
  root.addDynamic(
    For(
      () => items(),
      (n) => n,
      (n) => {
        const leaf = new Leaf();
        made.set(n, leaf);
        return leaf;
      },
    ),
  );

  const rr = createRenderRoot({ width: 10, height: 6 }, { caps });
  rr.mount(root);
  expect(root.children).toHaveLength(3);
  expect(root.children).toContain(made.get(2));

  items.set([1, 3]); // drop item 2
  expect(root.children).toHaveLength(2);
  expect(root.children).not.toContain(made.get(2)); // item 2's view unmounted
  expect(root.children).toContain(made.get(1));
  expect(root.children).toContain(made.get(3));
});
