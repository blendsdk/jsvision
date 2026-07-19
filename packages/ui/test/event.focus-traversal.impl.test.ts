/**
 * Implementation tests — scope-ceilinged tree-order traversal internals & edges.
 *
 * Covers: empty-start entry (first forward / last reverse) across nested groups; disabled-anchor
 * recovery under nesting, then bubbling out of an exhausted group; the walk runs on the Tab keypress
 * (not per paint frame) and resolves in one coalesced frame regardless of nesting depth; and a null
 * scope (nothing mounted) is a no-op. Real `View`/`Group` + a real loop (no mocks).
 */
import { test, expect, vi } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { createFocusManager } from '../src/event/focus.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function keyEvent(key: string, mods: Partial<Pick<KeyEvent, 'ctrl' | 'alt' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false, ...mods };
}

class Leaf extends View {
  draw(_ctx: DrawContext): void {}
}

function focusable(): Leaf {
  const leaf = new Leaf();
  leaf.focusable = true;
  return leaf;
}

// IMP-1 — nothing focused: focusNext enters the FIRST focusable in scope, focusPrev the LAST (descending
// into the last group's last leaf).
test('IMP-1: empty-start enters the first (forward) / last (reverse) focusable in scope', () => {
  function tree(): { a: Leaf; c: Leaf; root: Group } {
    const a = focusable();
    const b = focusable();
    const c = focusable();
    const g = new Group();
    g.add(b);
    g.add(c);
    const root = new Group();
    root.add(a);
    root.add(g);
    return { a, c, root };
  }

  {
    const { a, root } = tree();
    const loop = createEventLoop({ width: 20, height: 6 }, { caps });
    loop.mount(root);
    loop.focusNext(); // nothing focused → first focusable in scope
    expect(loop.getFocused()).toBe(a);
  }
  {
    const { c, root } = tree();
    const loop = createEventLoop({ width: 20, height: 6 }, { caps });
    loop.mount(root);
    loop.focusPrev(); // nothing focused → last focusable in scope (descends into g's last leaf)
    expect(loop.getFocused()).toBe(c);
  }
});

// IMP-2 — a disabled anchor inside a nested group recovers to the nearest in-direction candidate; when
// the whole group is exhausted, the walk bubbles out to the next sibling (extends hardening :263 to nesting).
test('IMP-2: disabled anchor recovers within the group, then bubbles out when the group is exhausted', () => {
  const a1 = focusable();
  const a2 = focusable();
  const g = new Group();
  g.add(a1);
  g.add(a2);
  const b = focusable();
  const root = new Group();
  root.add(g);
  root.add(b);

  const loop = createEventLoop({ width: 20, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(a1);

  a1.state.disabled = true; // disable the focused anchor
  loop.focusNext();
  expect(loop.getFocused()).toBe(a2); // recovered to the next candidate within the nested group

  a2.state.disabled = true; // now the group has no focusable child at all
  loop.focusNext();
  expect(loop.getFocused()).toBe(b); // bubbled out of the exhausted group to the next sibling
});

// IMP-3 — the walk runs on the Tab keypress, not per paint frame: a paint (resize) never moves focus,
// and one Tab press resolves the whole climb in a single coalesced frame regardless of nesting depth.
test('IMP-3: traversal is keypress-driven and one-shot, bounded by scope depth (not per frame)', () => {
  const deep = focusable();
  let node = new Group();
  node.add(deep);
  for (let i = 0; i < 12; i += 1) {
    const g = new Group();
    g.add(node);
    node = g; // 13 nesting levels above `deep`
  }
  const sib = focusable();
  const root = new Group();
  root.add(node);
  root.add(sib);

  const loop = createEventLoop({ width: 24, height: 8 }, { caps });
  loop.mount(root);
  loop.focusView(deep);
  expect(loop.getFocused()).toBe(deep);

  const before = loop.getFocused();
  loop.resize({ width: 28, height: 10 }); // a paint frame must NOT run the traversal
  expect(loop.getFocused()).toBe(before);

  const flushSpy = vi.spyOn(loop.renderRoot, 'flush');
  loop.dispatch(keyEvent('tab')); // one keypress climbs out of all 13 levels
  expect(loop.getFocused()).toBe(sib);
  expect(flushSpy).toHaveBeenCalledTimes(1); // one coalesced frame, regardless of nesting depth
});

// IMP-4 — a null scope (nothing mounted) is a no-op: neither direction focuses anything or throws.
test('IMP-4: a null scope is a no-op', () => {
  const mgr = createFocusManager(() => null);
  mgr.focusNext(null);
  mgr.focusPrev(null);
  expect(mgr.getFocused()).toBeNull();
});
