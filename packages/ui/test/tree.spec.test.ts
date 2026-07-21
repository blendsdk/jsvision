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
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { Tree } from '../src/tree/index.js';
import type { TreeNode } from '../src/tree/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}
function node<T>(value: T, children: TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}

/** A post-process spy recording every command dispatched on the tick. */
class CommandSpy extends View {
  override postProcess = true;
  readonly commands: string[] = [];
  draw(_ctx: DrawContext): void {}
  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'command') this.commands.push(ev.event.command);
  }
}

/** Mount a Tree filling `w×h` under a root Group (+ optional command spy) and focus its rows renderer. */
function hosted<T>(tree: Tree<T>, w: number, h: number, spy?: CommandSpy) {
  tree.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(tree);
  if (spy) root.add(spy);
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

// --- Phase 2: navigation + expand/collapse + mouse + selection (ST-12…ST-19) --------------------

// Small nested fixture: A ├ A1 (└ A1a) └ A2 ; used across the nav cases.
function nested(focused?: Signal<number>, selected?: Signal<number>, command?: string) {
  const a1a = node('A1a');
  const a1 = node('A1', [a1a]);
  const a2 = node('A2');
  const a = node('A', [a1, a2]);
  const roots = signal<TreeNode<string>[]>([a]);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, selected, command });
  return { tree, a, a1, a1a, a2, roots };
}

// ST-12 / AC-4 — `+` expands the focused node, `-` collapses it, `*` expands its whole subtree; the
// flattened list grows/shrinks and `focused` stays valid (TV `+`/`-`=adjust, `*`=expandAll, :523-531).
test('ST-12: +/-/* expand, collapse, and expand-subtree the focused node', () => {
  const focused = signal(0);
  const { tree } = nested(focused);
  const loop = hosted(tree, 20, 10);
  const buf = () => loop.renderRoot.buffer();

  // Collapsed initially ⇒ only A on row 0. `+` expands A ⇒ A1 appears on row 1 (text at col 6).
  loop.dispatch(key('+'));
  expect(buf().get(6, 1)?.char).toBe('A'); // 'A1'
  expect(focused()).toBe(0);

  // `-` collapses A ⇒ row 1 blank again.
  loop.dispatch(key('-'));
  expect(buf().get(6, 1)?.char).toBe(' ');

  // `*` expands A's whole subtree (A + A1) ⇒ A1a appears on row 2 (level 2, text at col 9).
  loop.dispatch(key('*'));
  expect(buf().get(9, 2)?.char).toBe('A'); // 'A1a'
});

// ST-13 / AC-5 — ← collapses an expanded node; on an already-collapsed node it moves focus to the
// parent (PA-12 override of TV's ←=up).
test('ST-13: ← collapses an expanded node, else moves focus to the parent', () => {
  const focused = signal(0);
  const { tree, a, a1 } = nested(focused);
  tree.expand(a);
  tree.expand(a1); // flatten = [A, A1, A1a, A2]
  const loop = hosted(tree, 20, 10);
  const buf = () => loop.renderRoot.buffer();
  focused.set(1); // focus A1 (expanded-with-children)

  // ← on the expanded A1 ⇒ collapse it (A1a disappears); focus stays on A1.
  loop.dispatch(key('left'));
  expect(focused()).toBe(1);
  expect(buf().get(9, 2)?.char).toBe(' '); // A1a gone (row 2 now A2 or blank)

  // ← again on the now-collapsed A1 ⇒ move focus to its parent A (index 0).
  loop.dispatch(key('left'));
  expect(focused()).toBe(0);
});

// ST-14 / AC-5 — → expands a collapsed node; on an already-expanded node it descends to the first
// child (PA-12 override of TV's →=down).
test('ST-14: → expands a collapsed node, else descends to the first child', () => {
  const focused = signal(0);
  const { tree, a } = nested(focused);
  tree.expand(a); // flatten = [A, A1(collapsed), A2]
  const loop = hosted(tree, 20, 10);
  const buf = () => loop.renderRoot.buffer();
  focused.set(1); // focus A1 (collapsed-with-children)

  // → on the collapsed A1 ⇒ expand it (A1a appears on row 2); focus stays on A1.
  loop.dispatch(key('right'));
  expect(focused()).toBe(1);
  expect(buf().get(9, 2)?.char).toBe('A'); // 'A1a' now visible

  // → again on the now-expanded A1 ⇒ descend to its first child A1a (index 2).
  loop.dispatch(key('right'));
  expect(focused()).toBe(2);
});

// ST-15 / Should-Have — expandAll()/collapseAll() instance methods expand/collapse the whole forest.
test('ST-15: expandAll() / collapseAll() expand and collapse the whole forest', () => {
  const { tree } = nested();
  const loop = hosted(tree, 20, 10);
  const buf = () => loop.renderRoot.buffer();

  tree.expandAll();
  loop.renderRoot.flush(); // direct method call ⇒ force the deferred frame
  // Whole forest visible ⇒ A1a on row 2 (deepest node).
  expect(buf().get(9, 2)?.char).toBe('A');

  tree.collapseAll();
  loop.renderRoot.flush();
  // Only the root A remains ⇒ row 1 blank.
  expect(buf().get(6, 1)?.char).toBe(' ');
});

// ST-16 / AC-6 (corrected by PA-14) — a click within the graph-prefix width toggles expand (no
// select); the clicked row becomes focused.
test('ST-16: a graph-zone click toggles expand without selecting', () => {
  const focused = signal(0);
  const selected = signal(-1);
  const { tree } = nested(focused, selected);
  const loop = hosted(tree, 20, 10);
  const buf = () => loop.renderRoot.buffer();

  // Click A's graph zone — 1-based (1,1) ⇒ view-local (0,0), x=0 < graphWidth(0)=3 ⇒ toggle, NOT select.
  loop.dispatch(mouse('down', 1, 1));
  loop.dispatch(mouse('up', 1, 1));
  expect(focused()).toBe(0); // clicked row is focused
  expect(selected()).toBe(-1); // NOT selected (graph-zone click)
  expect(buf().get(6, 1)?.char).toBe('A'); // A expanded ⇒ 'A1' on row 1
});

// ST-17 / AC-6 (corrected by double-click-activation AR-5) — a SINGLE click on the node text focuses
// ONLY: no select, no emit. TV `TOutlineViewer::handleEvent` (`toutline.cpp:465-472`) activates via
// `selected(foc)` only on `meDoubleClick`; a single text click does nothing (the port's single-click
// text emit was non-TV and is dropped). Double-click text activation is pinned in
// `multiclick.consumers.spec.test.ts` ST-7.
test('ST-17: a single text click focuses only — no select, no emit (TV toutline.cpp:465)', () => {
  const focused = signal(0);
  const selected = signal(-1);
  const { tree, a } = nested(focused, selected, 'open');
  tree.expand(a); // flatten = [A, A1, A2]; A1 text at col 6 (level 1)
  const spy = new CommandSpy();
  const loop = hosted(tree, 20, 10, spy);

  // Click A1's text — 1-based (7,2) ⇒ view-local (6,1), x=6 ≥ graphWidth(1)=6 ⇒ focus only.
  loop.dispatch(mouse('down', 7, 2));
  loop.dispatch(mouse('up', 7, 2));
  expect(focused()).toBe(1); // clicked row is focused
  expect(selected()).toBe(-1); // NOT selected — a single text click never activates (AR-5)
  expect(spy.commands).not.toContain('open'); // no command emitted
});

// ST-18 / AC-7 — Enter on the focused row selects it + emits the command (TV kbEnter ⇒ selected).
test('ST-18: Enter selects the focused row and emits the command', () => {
  const focused = signal(0);
  const selected = signal(-1);
  const { tree, a } = nested(focused, selected, 'open');
  tree.expand(a);
  const spy = new CommandSpy();
  const loop = hosted(tree, 20, 10, spy);

  loop.dispatch(key('down')); // focus A1 (index 1)
  loop.dispatch(key('enter'));
  expect(selected()).toBe(1);
  expect(spy.commands).toContain('open');
});

// ST-19 / AC-8 — a generic TreeNode<T> renders via getText; user node data carries no reactive
// wrapper, and updating roots/expand re-flattens + repaints.
test('ST-19: a generic TreeNode<T> renders via getText; roots/expand updates re-flatten', () => {
  interface Entry {
    readonly name: string;
    readonly id: number;
  }
  const child: TreeNode<Entry> = node({ name: 'child', id: 2 });
  const root: TreeNode<Entry> = node({ name: 'parent', id: 1 }, [child]);
  const roots = signal<TreeNode<Entry>[]>([root]);
  const tree = new Tree<Entry>({ roots, getText: (e) => e.name });
  const loop = hosted(tree, 20, 6);
  const buf = () => loop.renderRoot.buffer();

  // 'parent' rendered via getText at col 3 (level 0). Node data is a plain object (no wrapper).
  expect(buf().get(3, 0)?.char).toBe('p');
  expect(root.value).toStrictEqual({ name: 'parent', id: 1 });

  // Expanding re-flattens ⇒ 'child' appears on row 1 (col 6).
  loop.dispatch(key('right')); // → expands the collapsed-with-children root
  expect(buf().get(6, 1)?.char).toBe('c');
});
