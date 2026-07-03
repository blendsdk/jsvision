/**
 * Specification tests (immutable oracles) — RD-15 `Tree<T>` / `TreeRows<T>` render + virtual scroll
 * (ST-8…ST-11) and navigation + mouse + selection (ST-12…ST-19, added in Phase 2).
 *
 * Source: jsvision-ui/RD-15 AC-1/AC-3/AC-4/AC-5/AC-6/AC-7/AC-10 (with the PA-14 correction to AC-6) →
 * the ST cases in tree/07-testing-strategy.md. TV oracle: `TOutlineViewer` (`toutline.cpp`):
 *   • `drawTree` (`:54-102`) — per visible row: clear in the row colour, draw the graph prefix at
 *     `x = strwidth(graph)`, then the node text two-tone (`c = (flags & ovExpanded) ? color : color>>8`,
 *     `:82`); row colour focused `getColor(0x0202)` > selected `getColor(0x0303)` > normal `getColor(0x0401)`.
 *   • `setLimit(updateMaxX, updateCount)` (`:592`) — the owned vertical bar range = flattened count.
 * Expectations derive from that decode + the ACs, NEVER from the implementation. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { Tree } from '../src/tree/index.js';
import type { TreeNode } from '../src/tree/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}
function node<T>(value: T, children: TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}

/** Mount a Tree filling `w×h` under a root Group and focus its rows renderer. */
function hosted<T>(tree: Tree<T>, w: number, h: number) {
  tree.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(tree);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.focusView(tree.rows);
  return loop;
}

// A 101-row expanded tree: one root + 100 leaf children (for virtual-scroll cases).
function bigTree(focused?: Signal<number>, onGetText?: () => void): Tree<string> {
  const children = Array.from({ length: 100 }, (_, i) => node(`f${i}`));
  const roots = signal<TreeNode<string>[]>([node('root', children)]);
  return new Tree<string>({
    roots,
    getText: (v) => {
      onGetText?.();
      return v;
    },
    focused,
    expandedByDefault: true,
  });
}

// ST-8 / AC-1+AC-10 — virtual-window draw: only the visible (expanded) rows are materialized (getText
// ≪ tree size); each row = the graph prefix then getText at the post-graph column.
test('ST-8: Tree draws only the visible window; each row = graph prefix + text at the post-graph column', () => {
  let getTextCalls = 0;
  const tree = bigTree(undefined, () => (getTextCalls += 1));
  const loop = hosted(tree, 20, 5);
  const buf = () => loop.renderRoot.buffer();

  // 101 rows exist but only ~5 fit; the renderer never materializes the whole tree.
  expect(getTextCalls).toBeLessThan(40);

  // Row 0 = 'root' (the only root ⇒ `└` corner), text 'root' at post-graph column 3 (graphWidth(0)).
  expect(buf().get(0, 0)?.char).toBe('└');
  expect(buf().get(3, 0)?.char).toBe('r');
  // Row 1 = 'f0' (a child, level 1 ⇒ `├` fork at col 3), text 'f0' at post-graph column 6 (graphWidth(1)).
  expect(buf().get(3, 1)?.char).toBe('├');
  expect(buf().get(6, 1)?.char).toBe('f');
});

// ST-9 / AC-1 — ↑↓ move focus ±1, PgDn pages by size.y-1 (TV `newFocus += size.y-1`, :498); the
// focused row stays visible (keepVisible); the owned bar reflects the flattened count + follows focus.
test('ST-9: ↑↓ moves focus ±1, PgDn pages, and keeps the focused row visible', () => {
  const focused = signal(0);
  const tree = bigTree(focused);
  const loop = hosted(tree, 20, 10);
  const buf = () => loop.renderRoot.buffer();

  const focusedVisible = (): boolean => {
    for (let y = 0; y < 10; y += 1) if (buf().get(0, y)?.bg === defaultTheme.outlineFocused.bg) return true;
    return false;
  };

  // Focused row 0 renders in outlineFocused (a distinct bar — PA-16). It is the only focus indicator.
  expect(buf().get(0, 0)?.bg).toBe(defaultTheme.outlineFocused.bg);

  loop.dispatch(key('down'));
  expect(focused()).toBe(1);
  expect(buf().get(0, 1)?.bg).toBe(defaultTheme.outlineFocused.bg);

  loop.dispatch(key('up'));
  expect(focused()).toBe(0);

  // PgDn pages by size.y-1 = 9 (TV faithful) ⇒ focused 9; still visible.
  loop.dispatch(key('pagedown'));
  expect(focused()).toBe(9);
  expect(focusedVisible()).toBe(true);

  // Another PgDn ⇒ 18; the window scrolls to keep it visible.
  loop.dispatch(key('pagedown'));
  expect(focused()).toBe(18);
  expect(focusedVisible()).toBe(true);
});

// ST-10 / AC-3 — two-tone: a COLLAPSED normal node's text draws in outlineNotExpanded; an EXPANDED
// (or leaf) normal node's text draws in outlineNormal; focus/select rows are single-tone (PA-11).
test('ST-10: collapsed normal text = outlineNotExpanded, expanded normal text = outlineNormal (two-tone)', () => {
  //   A (expanded)      ← normal, expanded  ⇒ text outlineNormal (yellow)
  //   │  └ A1 (collapsed, has child) ← normal, collapsed ⇒ text outlineNotExpanded (white)
  //   B (focused)       ← focused ⇒ single-tone outlineFocused
  const a1a = node('A1a');
  const a1 = node('A1', [a1a]);
  const b1 = node('B1');
  const a = node('A', [a1]);
  const b = node('B', [b1]);
  const roots = signal<TreeNode<string>[]>([a, b]);
  const focused = signal(2); // focus B (row 2) so A + A1 are unfocused/unselected
  const tree = new Tree<string>({ roots, getText: (v) => v, focused });
  tree.expand(a); // A expanded; A1 stays collapsed (has a child); B stays collapsed
  const loop = hosted(tree, 20, 5);
  const buf = () => loop.renderRoot.buffer();

  // flatten = [A, A1, B]. A text at col 3 (level 0), A1 text at col 6 (level 1), B text at col 3.
  expect(buf().get(3, 0)?.fg).toBe(defaultTheme.outlineNormal.fg); // A expanded ⇒ normal (yellow)
  expect(buf().get(6, 1)?.fg).toBe(defaultTheme.outlineNotExpanded.fg); // A1 collapsed ⇒ notExpanded (white)
  // The two tones genuinely differ (proves the high/low-byte split, not a single colour).
  expect(defaultTheme.outlineNormal.fg).not.toBe(defaultTheme.outlineNotExpanded.fg);
  // The graph prefix stays in the ROW colour (outlineNormal), even for the collapsed A1 row.
  expect(buf().get(0, 1)?.fg).toBe(defaultTheme.outlineNormal.fg);
  // B is focused ⇒ single-tone outlineFocused bar (bg), regardless of B being collapsed.
  expect(buf().get(0, 2)?.bg).toBe(defaultTheme.outlineFocused.bg);
});

// ST-11 / AC-3+AC-10 — row role priority: focused > selected > normal (TV tests focused before selected).
test('ST-11: row role priority is focused > selected > normal', () => {
  const roots = signal<TreeNode<string>[]>([node('X'), node('Y'), node('Z')]);
  const focused = signal(0);
  const selected = signal(0);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, selected });
  const loop = hosted(tree, 20, 5);
  const buf = () => loop.renderRoot.buffer();

  // Row 0 is both focused and selected ⇒ focused wins (outlineFocused).
  expect(buf().get(0, 0)?.bg).toBe(defaultTheme.outlineFocused.bg);

  // Move focus to row 1 ⇒ row 0 is now only selected (outlineSelected); row 1 focused.
  loop.dispatch(key('down'));
  expect(buf().get(0, 0)?.bg).toBe(defaultTheme.outlineSelected.bg);
  expect(buf().get(0, 1)?.bg).toBe(defaultTheme.outlineFocused.bg);
  // Row 2 is neither ⇒ normal.
  expect(buf().get(0, 2)?.bg).toBe(defaultTheme.outlineNormal.bg);
});
