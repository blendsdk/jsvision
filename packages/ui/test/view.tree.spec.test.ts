/**
 * Specification tests (immutable oracles) — View/Group retained tree & lifecycle.
 *
 * Source: RD-03 AC-1, AC-11, AC-15 → ST-01, ST-11, ST-15
 * (codeops/features/jsvision-ui/plans/view-group-spine/07-testing-strategy.md).
 * Expectations derive from the acceptance criteria, never from the implementation.
 *
 * Phase 2 has no render root yet (Phase 5), so lifecycle/identity are asserted directly
 * against the retained tree + owner scopes — the mount harness drives `view.mount(host,
 * parentScope)` under a `createRoot` scope (RT-2). The `.js` specifier is NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { signal, createRoot, getOwner } from '../src/reactive/index.js';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';

/** Minimal concrete View for lifecycle tests — draw() is irrelevant here (no render in Phase 2). */
class TestView extends View {
  draw(_ctx: DrawContext): void {
    // no-op: rendering is asserted in the Phase 5/6 render specs
  }
}

// ST-01 / AC-1 — the tree is retained: a Group keeps the SAME child View instances across a
// re-render cycle (no virtual DOM recreates them).
test('ST-01: a Group retains the same child View instances across an invalidate cycle', () => {
  const a = new TestView();
  const b = new TestView();
  const group = new Group();
  group.add(a);
  group.add(b);

  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    group.mount(null, getOwner());
  });

  // A repaint cycle must not replace child instances.
  group.invalidate();
  expect(group.children).toHaveLength(2);
  expect(group.children[0]).toBe(a); // same instance, not a copy
  expect(group.children[1]).toBe(b);

  dispose();
});

// ST-11 / AC-11 — removing a subtree disposes its owner scope: onCleanup runs, and a signal
// that fed a removed view triggers no further work.
test('ST-11: Group.remove disposes the child scope, runs onCleanup, and stops reactive work', () => {
  const s = signal(0);
  let applies = 0;
  let cleanups = 0;

  const child = new TestView();
  const group = new Group();
  group.add(child);

  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    group.mount(null, getOwner());
  });

  child.onCleanup(() => {
    cleanups += 1;
  });
  child.bind(
    () => s(),
    () => {
      applies += 1;
    },
  );
  expect(applies).toBe(1); // bind's initial apply

  s.set(1);
  expect(applies).toBe(2); // reactive while mounted

  group.remove(child);
  expect(cleanups).toBe(1); // onCleanup fired exactly once on disposal

  s.set(2);
  expect(applies).toBe(2); // disposed: the removed view's bind runs no more work

  dispose();
});

// ST-15 / AC-15 — onEvent exists and is overridable but performs no dispatch/focus logic in RD-03.
test('ST-15: View.onEvent exists, is overridable, and changes no state in RD-03', () => {
  const v = new TestView();
  expect(typeof v.onEvent).toBe('function');

  const stateBefore = { ...v.state };
  v.onEvent({ type: 'key', value: 'x' }); // the stub must not dispatch or mutate state
  expect({ ...v.state }).toEqual(stateBefore);

  // Overridable by a subclass (the custom-widget escape hatch).
  let handled: unknown = null;
  class CustomView extends View {
    draw(_ctx: DrawContext): void {}
    override onEvent(ev: unknown): void {
      handled = ev;
    }
  }
  const c = new CustomView();
  c.onEvent({ type: 'mouse' });
  expect(handled).toEqual({ type: 'mouse' });
});
