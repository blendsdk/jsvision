/**
 * Implementation tests — dynamic children (internals & edges; 07 §impl).
 *
 * For key-reorder reuses instances, Show else-branch mount/unmount, and a dropped For item runs
 * no further work (its onCleanup fired).
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

test('For key reorder reuses the same view instances (retained identity through a move)', () => {
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
  const v1 = made.get(1);
  const v2 = made.get(2);
  const v3 = made.get(3);

  items.set([3, 1, 2]); // reorder — keyed by value, so instances are reused (render not re-run)
  expect(made.get(1)).toBe(v1);
  expect(made.get(2)).toBe(v2);
  expect(made.get(3)).toBe(v3);
  expect(root.children).toHaveLength(3);
});

test('Show else-branch mounts when false and swaps on flip', () => {
  const cond = signal(true);
  const thenView = new Leaf();
  const elseView = new Leaf();
  const root = new Group();
  root.layout = { direction: 'col' };
  root.addDynamic(
    Show(
      () => cond(),
      () => thenView,
      () => elseView,
    ),
  );

  const rr = createRenderRoot({ width: 10, height: 5 }, { caps });
  rr.mount(root);
  expect(root.children).toContain(thenView);
  expect(root.children).not.toContain(elseView);

  cond.set(false);
  expect(root.children).toContain(elseView);
  expect(root.children).not.toContain(thenView);
});

test('a dropped For item runs its onCleanup and no further work', () => {
  const items = signal<number[]>([1, 2]);
  const cleanups = new Map<number, number>();
  const root = new Group();
  root.layout = { direction: 'col' };
  root.addDynamic(
    For(
      () => items(),
      (n) => n,
      (n) => {
        const leaf = new Leaf();
        leaf.onMount(() => {
          leaf.onCleanup(() => {
            cleanups.set(n, (cleanups.get(n) ?? 0) + 1);
          });
        });
        return leaf;
      },
    ),
  );

  const rr = createRenderRoot({ width: 10, height: 5 }, { caps });
  rr.mount(root);
  items.set([1]); // drop item 2

  expect(cleanups.get(2)).toBe(1); // item 2's onCleanup fired on unmount
  expect(root.children).toHaveLength(1);
});
