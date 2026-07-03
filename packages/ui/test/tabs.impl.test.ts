/**
 * Implementation tests — RD-17 `TabView` internals + view-free helpers (03-01, 07 §Impl).
 *
 * Edge/branch coverage the spec oracles don't pin: the pure nav helpers (`clampActive`/`firstEnabled`
 * /`nextEnabled`/`prevEnabled`/`neighbourAfterRemove`) across wrap/all-disabled(-1)/empty, the
 * `isWithin` focus-scoping predicate (self/descendant/foreign/null), `onChange` de-dupe, snap edges,
 * and read-time re-clamp on a raw `active.set`. `.js` per NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { TabView } from '../src/tabs/index.js';
import type { Tab } from '../src/tabs/index.js';
import {
  clampActive,
  firstEnabled,
  nextEnabled,
  prevEnabled,
  neighbourAfterRemove,
  isWithin,
} from '../src/tabs/tab-view.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A tab descriptor with just the enabled/disabled flag the pure helpers read. */
function t(disabled = false): Tab {
  return { title: 'x', content: new Group(), disabled };
}

// --- clampActive ---------------------------------------------------------------------------------

test('clampActive clamps into [0, len-1], handles empty + non-finite', () => {
  expect(clampActive(5, 3)).toBe(2);
  expect(clampActive(-2, 3)).toBe(0);
  expect(clampActive(1, 3)).toBe(1);
  expect(clampActive(0, 0), 'empty → 0 (callers bounds-check)').toBe(0);
  expect(clampActive(Number.NaN, 3), 'NaN → 0').toBe(0);
  expect(clampActive(2.9, 5), 'floors fractional').toBe(2);
});

// --- firstEnabled --------------------------------------------------------------------------------

test('firstEnabled returns the first enabled index, or -1 for none/empty', () => {
  expect(firstEnabled([t(true), t(false), t(false)])).toBe(1);
  expect(firstEnabled([t(false)])).toBe(0);
  expect(firstEnabled([t(true), t(true)]), 'all disabled → -1').toBe(-1);
  expect(firstEnabled([]), 'empty → -1').toBe(-1);
});

// --- nextEnabled / prevEnabled -------------------------------------------------------------------

test('nextEnabled advances with wrap, skips disabled, returns from if sole-enabled, -1 if none', () => {
  const tabs = [t(false), t(true), t(false)];
  expect(nextEnabled(tabs, 0), 'skips disabled 1 → 2').toBe(2);
  expect(nextEnabled(tabs, 2), 'wraps 2 → 0').toBe(0);
  expect(nextEnabled([t(false), t(true), t(true)], 0), 'sole enabled returns itself').toBe(0);
  expect(nextEnabled([t(true), t(true)], 0), 'none enabled → -1').toBe(-1);
  expect(nextEnabled([], 0), 'empty → -1').toBe(-1);
  expect(nextEnabled(tabs, 1), 'from a DISABLED index → next enabled (2)').toBe(2);
});

test('prevEnabled retreats with wrap, symmetric to nextEnabled', () => {
  const tabs = [t(false), t(true), t(false)];
  expect(prevEnabled(tabs, 2), 'skips disabled 1 → 0').toBe(0);
  expect(prevEnabled(tabs, 0), 'wraps 0 → 2').toBe(2);
  expect(prevEnabled([t(false), t(true), t(true)], 0), 'sole enabled returns itself').toBe(0);
  expect(prevEnabled([t(true), t(true)], 1), 'none enabled → -1').toBe(-1);
  expect(prevEnabled([], 0), 'empty → -1').toBe(-1);
});

// --- neighbourAfterRemove ------------------------------------------------------------------------

test('neighbourAfterRemove: prev if the removed was last, else the same slot; 0 for empty', () => {
  // Removing the last of a 3-list (newLen 2): removedIndex 2 >= 2 → newLen-1 = 1 (prev).
  expect(neighbourAfterRemove(2, 2)).toBe(1);
  // Removing the middle of a 3-list (newLen 2): removedIndex 1 < 2 → same slot (1) = the next tab.
  expect(neighbourAfterRemove(1, 2)).toBe(1);
  // Removing the first (newLen 2): 0 < 2 → same slot (0).
  expect(neighbourAfterRemove(0, 2)).toBe(0);
  // Removing the only tab (newLen 0) → 0 (guarded; caller shows no page).
  expect(neighbourAfterRemove(0, 0)).toBe(0);
});

// --- isWithin ------------------------------------------------------------------------------------

test('isWithin: self, descendant, foreign, and a null leaf', () => {
  const root = new Group();
  const child = new Group();
  const leaf = new Group();
  root.children.push(child);
  child.parent = root;
  child.children.push(leaf);
  leaf.parent = child;
  const foreign = new Group();

  expect(isWithin(root, root), 'self').toBe(true);
  expect(isWithin(leaf, root), 'descendant (grandchild)').toBe(true);
  expect(isWithin(child, root), 'direct child').toBe(true);
  expect(isWithin(root, leaf), 'root is NOT within its own leaf').toBe(false);
  expect(isWithin(foreign, root), 'foreign view').toBe(false);
  expect(isWithin(null, root), 'null leaf').toBe(false);
});

// --- Integration: onChange de-dupe + read-time re-clamp ------------------------------------------

/** A focusable content leaf (paints nothing meaningful; just a mountable page). */
class Leaf extends View {
  override focusable = true;
  override layout = { size: { kind: 'fr' as const, weight: 1 } };
  draw(_ctx: DrawContext): void {}
}
function page(): Group {
  const g = new Group();
  g.layout = { direction: 'col' };
  g.add(new Leaf());
  return g;
}
function host(view: TabView, w = 30, h = 6) {
  view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(view);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  return loop;
}

test('onChange does not fire when active is re-set to the SAME effective index (de-dupe)', () => {
  const changes: number[] = [];
  const tabs = signal<Tab[]>([
    { title: 'A', content: page() },
    { title: 'B', content: page() },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active, onChange: (i) => changes.push(i) });
  const loop = host(view);
  active.set(0); // same value
  loop.renderRoot.flush();
  active.set(1);
  loop.renderRoot.flush();
  active.set(1); // same value again
  loop.renderRoot.flush();
  expect(changes, 'only the genuine 0→1 change fires').toEqual([1]);
});

test('read-time re-clamp fires on a raw active.set that lands on a disabled tab (snaps forward)', () => {
  const tabs = signal<Tab[]>([
    { title: 'A', content: page() },
    { title: 'B', content: page(), disabled: true },
    { title: 'C', content: page() },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active });
  const loop = host(view);
  active.set(1); // raw set onto a DISABLED tab, bypassing select()
  loop.renderRoot.flush();
  expect(active(), 'snapped forward off the disabled tab to 2').toBe(2);
});

test('all-disabled leaves active untouched and shows no page (no infinite loop)', () => {
  const tabs = signal<Tab[]>([
    { title: 'A', content: page(), disabled: true },
    { title: 'B', content: page(), disabled: true },
  ]);
  const active = signal(0);
  const view = new TabView({ tabs, active });
  const loop = host(view);
  expect(() => loop.renderRoot.flush()).not.toThrow();
  // resolveActive → -1; the effect leaves the caller's `active` as-is (never writes -1).
  expect(active()).toBe(0);
});
