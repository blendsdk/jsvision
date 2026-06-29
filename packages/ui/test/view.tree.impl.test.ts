/**
 * Implementation tests — View/Group retained tree (internals & edges; 07 §impl).
 *
 * Deferred-vs-immediate child mount, depth-first disposal, onMount-once (via the reflow drain),
 * and double-remove safety. Exercises the mount wiring (RT-1/RT-2/RT-3) the ST oracles assume.
 */
import { test, expect } from 'vitest';
import { createRoot, getOwner } from '../src/reactive/index.js';
import { View, Group } from '../src/view/index.js';

/** Minimal concrete View — rendering is irrelevant to lifecycle internals. */
class TestView extends View {
  draw(): void {
    // no-op
  }
}

test('add before mount defers the child mount; add after mount mounts immediately', () => {
  const group = new Group();
  const early = new TestView();
  group.add(early);
  expect(early.mounted).toBe(false); // group not mounted yet → deferred

  createRoot(() => group.mount(null, getOwner()));
  expect(early.mounted).toBe(true); // child mounted when the group mounted

  const late = new TestView();
  group.add(late);
  expect(late.mounted).toBe(true); // group already mounted → immediate
});

test('disposing a subtree tears down depth-first (descendant onCleanup before ancestor)', () => {
  const order: string[] = [];
  const outer = new Group();
  const inner = new Group();
  const leaf = new TestView();
  inner.add(leaf);
  outer.add(inner);

  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    outer.mount(null, getOwner());
  });

  leaf.onCleanup(() => order.push('leaf'));
  inner.onCleanup(() => order.push('inner'));
  outer.onCleanup(() => order.push('outer'));

  dispose();
  expect(order).toEqual(['leaf', 'inner', 'outer']);
});

test('onMount fires once, after the first reflow drain, and not before', () => {
  let mounts = 0;
  const view = new TestView();
  const group = new Group();
  group.add(view);
  createRoot(() => group.mount(null, getOwner()));

  view.onMount(() => {
    mounts += 1;
  });
  expect(mounts).toBe(0); // registered but not yet live (no reflow drain)

  view.runPendingMounts();
  expect(mounts).toBe(1); // fired after the first reflow

  view.runPendingMounts();
  expect(mounts).toBe(1); // idempotent — never re-fired

  // Registering after the view is live runs immediately.
  view.onMount(() => {
    mounts += 1;
  });
  expect(mounts).toBe(2);
});

test('removing a child twice is a safe no-op (onCleanup ran once)', () => {
  let cleanups = 0;
  const group = new Group();
  const child = new TestView();
  group.add(child);
  createRoot(() => group.mount(null, getOwner()));

  child.onCleanup(() => {
    cleanups += 1;
  });

  group.remove(child);
  expect(() => group.remove(child)).not.toThrow();
  expect(cleanups).toBe(1);
  expect(group.children).toHaveLength(0);
});

test('bind() before mount throws a TuiError (fail-fast, PA-2)', () => {
  const view = new TestView();
  expect(() => view.bind(() => 1)).toThrow();
});
