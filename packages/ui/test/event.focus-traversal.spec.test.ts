/**
 * Specification tests (immutable oracles) — scope-ceilinged tree-order focus traversal.
 *
 * The DFS contract for `Tab` / `Shift-Tab`: focus walks the view tree in document order, crossing out
 * of a fully-traversed group into its parent's next focusable sibling, bounded by the active
 * modal/window scope, wrapping at that ceiling. Shift-Tab is the exact inverse of Tab. Container
 * "restore" memory is kept for a non-Tab entry (click / `focusView` / window switch) but continuous
 * Tab is pure tree order.
 *
 * Expectations derive from the requirements (RD-01 FR-3 + this plan's R-1…R-4), never from the
 * implementation. Real `View`/`Group` + a real loop-built `RenderRoot` (no mocks); focus is driven
 * through the PUBLIC loop surface (`focusView`/`focusNext`/`focusPrev`/`getFocused` + dispatched
 * `Tab`/`Shift-Tab`), mirroring `event.focus.spec.test.ts`.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { col, row } from '../src/view/dsl/index.js';
import { createEventLoop } from '../src/event/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function keyEvent(key: string, mods: Partial<Pick<KeyEvent, 'ctrl' | 'alt' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false, ...mods };
}

/** A focusable leaf. */
class Leaf extends View {
  draw(_ctx: DrawContext): void {}
}

function focusable(): Leaf {
  const leaf = new Leaf();
  leaf.focusable = true;
  return leaf;
}

/** A focusable leaf that counts the plain key events it receives (to prove Tab is consumed). */
class CountLeaf extends View {
  keys = 0;
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'key') this.keys += 1;
  }
}

function countLeaf(): CountLeaf {
  const leaf = new CountLeaf();
  leaf.focusable = true;
  return leaf;
}

// ST-F1 — Tab EXITS a nested group into the next sibling instead of wrapping inside the group.
test('ST-F1: Tab exits a nested group into the next focusable sibling (no group-scoped wrap)', () => {
  const a1 = focusable();
  const a2 = focusable();
  const g1 = new Group();
  g1.add(a1);
  g1.add(a2);
  const b = focusable();
  const root = new Group();
  root.add(g1);
  root.add(b);

  const loop = createEventLoop({ width: 20, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(a2); // last focusable of g1
  expect(loop.getFocused()).toBe(a2);

  loop.focusNext();
  expect(loop.getFocused()).toBe(b); // exits g1 into b — NOT a group-scoped wrap back to a1
});

// ST-F2 — tree order across two nesting levels, wrap at scope, and Shift-Tab reverses exactly.
test('ST-F2: Tab walks tree order across two nesting levels and wraps; Shift-Tab is the exact inverse', () => {
  const a1 = focusable();
  const g2 = new Group();
  g2.add(a1);
  const a2 = focusable();
  const g1 = new Group();
  g1.add(g2);
  g1.add(a2);
  const b = focusable();
  const root = new Group();
  root.add(g1);
  root.add(b);

  const loop = createEventLoop({ width: 20, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(a1);

  loop.focusNext();
  expect(loop.getFocused()).toBe(a2);
  loop.focusNext();
  expect(loop.getFocused()).toBe(b);
  loop.focusNext();
  expect(loop.getFocused()).toBe(a1); // wrap at the scope

  loop.focusPrev();
  expect(loop.getFocused()).toBe(b); // reverse is the exact inverse
  loop.focusPrev();
  expect(loop.getFocused()).toBe(a2);
  loop.focusPrev();
  expect(loop.getFocused()).toBe(a1);
});

// ST-F3 — wrap at the scope ceiling in both directions (reverse wraps into the last leaf).
test('ST-F3: Tab wraps to the scope start, Shift-Tab wraps into the last leaf of the last group', () => {
  const a = focusable();
  const b = focusable();
  const c = focusable();
  const g = new Group();
  g.add(b);
  g.add(c);
  const root = new Group();
  root.add(a);
  root.add(g);

  const loop = createEventLoop({ width: 20, height: 6 }, { caps });
  loop.mount(root);

  loop.focusView(c); // last focusable in scope
  loop.focusNext();
  expect(loop.getFocused()).toBe(a); // wrap to the scope start

  loop.focusView(a);
  loop.focusPrev();
  expect(loop.getFocused()).toBe(c); // reverse wrap descends into g's LAST leaf
});

// ST-F4 — a non-Tab entry keeps a container's restore memory while continuous Tab stays tree order.
test('ST-F4: non-Tab entry restores the saved child; continuous Tab is pure tree order', () => {
  const a1 = focusable();
  const a2 = focusable();
  const g1 = new Group();
  g1.add(a1);
  g1.add(a2);
  const b1 = focusable();
  const b2 = focusable();
  const g2 = new Group();
  g2.add(b1);
  g2.add(b2);
  const root = new Group();
  root.add(g1);
  root.add(g2);

  const loop = createEventLoop({ width: 20, height: 6 }, { caps });
  loop.mount(root);

  loop.focusNext();
  expect(loop.getFocused()).toBe(a1);
  loop.focusNext();
  expect(loop.getFocused()).toBe(a2); // g1's saved child is now a2

  loop.focusView(b1); // NON-Tab jump into g2 — leaves g1 without a climb, so g1's memory is kept
  expect(loop.getFocused()).toBe(b1);
  loop.focusNext();
  expect(loop.getFocused()).toBe(b2);

  loop.focusNext();
  // Wrap: g1 was left by a non-Tab path so focusInto restores its saved a2 (not a1); g2, which Tab
  // just climbed out of, was reset (a re-entry would go to b1). Restore survives; Tab stays tree order.
  expect(loop.getFocused()).toBe(a2);
});

// ST-F5 — with a modal open, traversal is confined to the modal subtree and never reaches behind it.
test('ST-F5: a modal confines Tab to its subtree and never focuses a view behind it', () => {
  const bg = focusable(); // desktop behind the modal — must stay unreachable
  const ok = focusable();
  const cancel = focusable();
  const dialog = new Group();
  dialog.add(ok);
  dialog.add(cancel);
  const root = new Group();
  root.add(bg);
  root.add(dialog);

  const loop = createEventLoop({ width: 20, height: 8 }, { caps });
  loop.mount(root);
  void loop.execView(dialog); // opens modal; focuses into the modal's first focusable (ok)
  expect(loop.getFocused()).toBe(ok);

  loop.dispatch(keyEvent('tab'));
  expect(loop.getFocused()).toBe(cancel);
  loop.dispatch(keyEvent('tab'));
  expect(loop.getFocused()).toBe(ok); // wraps WITHIN the modal — does not escape to bg
  loop.dispatch(keyEvent('tab', { shift: true }));
  expect(loop.getFocused()).toBe(cancel); // reverse wrap, still within the modal
  expect(loop.getFocused()).not.toBe(bg);
});

// ST-F6 — the whole point: a dialog built from nested col/row DSL groups is fully traversable.
test('ST-F6: a col(row(input), row(ok, cancel)) dialog is fully Tab-traversable in tree order', () => {
  const input = focusable();
  const ok = focusable();
  const cancel = focusable();
  const dlg = col(row(input), row(ok, cancel));
  const root = new Group();
  root.add(dlg);

  const loop = createEventLoop({ width: 30, height: 8 }, { caps });
  loop.mount(root);
  loop.focusView(input);

  loop.focusNext();
  expect(loop.getFocused()).toBe(ok);
  loop.focusNext();
  expect(loop.getFocused()).toBe(cancel);
  loop.focusNext();
  expect(loop.getFocused()).toBe(input); // wrap

  loop.focusPrev();
  expect(loop.getFocused()).toBe(cancel);
  loop.focusPrev();
  expect(loop.getFocused()).toBe(ok);
  loop.focusPrev();
  expect(loop.getFocused()).toBe(input);
});

// ST-F7 — the key path: a dispatched unbound Tab/Shift-Tab crosses group boundaries and is consumed.
test('ST-F7: dispatched Tab/Shift-Tab cross group boundaries and the keys are consumed', () => {
  const a1 = countLeaf();
  const a2 = countLeaf();
  const g1 = new Group();
  g1.add(a1);
  g1.add(a2);
  const b = countLeaf();
  const root = new Group();
  root.add(g1);
  root.add(b);

  const loop = createEventLoop({ width: 20, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(a2);

  loop.dispatch(keyEvent('tab'));
  expect(loop.getFocused()).toBe(b); // Tab exits g1 across the group boundary
  loop.dispatch(keyEvent('tab', { shift: true }));
  expect(loop.getFocused()).toBe(a2); // Shift-Tab reverse wraps into g1's last leaf

  expect(a2.keys).toBe(0); // the Tab keys were consumed, never delivered as plain keys
  expect(b.keys).toBe(0);
});
