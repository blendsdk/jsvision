/**
 * Implementation tests — RD-15 `Tree`/`TreeRows` edge cases + internals (written AFTER the spec is
 * green). Phase 1: `expandedByDefault` seeding, a `roots` swap resetting expand state, the empty-tree
 * `<empty>` placeholder, and the owned-`ScrollBar` wiring/range. Phase 2 cases append below.
 * `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent, WheelEvent as CoreWheelEvent } from '@jsvision/core';
import { View, Group } from '../src/view/index.js';
import type { DrawContext, DispatchEvent } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Tree } from '../src/tree/index.js';
import type { TreeNode } from '../src/tree/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}
function wheel(dir: 'up' | 'down', x: number, y: number): CoreWheelEvent {
  return { type: 'wheel', dir, x, y, shift: false, alt: false, ctrl: false };
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

test('expandedByDefault:true seeds every node with children as expanded (whole tree visible)', () => {
  //   A ├ A1 (└ A1a) └ A2 ; B (leaf). All expanded ⇒ flatten = [A, A1, A1a, A2, B] = 5 rows.
  const a1a = node('A1a');
  const a1 = node('A1', [a1a]);
  const a2 = node('A2');
  const a = node('A', [a1, a2]);
  const b = node('B');
  const roots = signal<TreeNode<string>[]>([a, b]);
  const tree = new Tree<string>({ roots, getText: (v) => v, expandedByDefault: true });
  const loop = hosted(tree, 20, 10);
  const buf = () => loop.renderRoot.buffer();

  expect(tree.isExpanded(a)).toBe(true);
  expect(tree.isExpanded(a1)).toBe(true);
  // A leaf is never in the expand set (it has no children to expand).
  expect(tree.isExpanded(a1a)).toBe(false);
  // All 5 rows render (A, A1, A1a, A2, B) — the deepest text 'A1a' at level 2 (col 9) is present.
  expect(buf().get(0, 0)?.char).toBe('├'); // A: not last (B follows) ⇒ fork
  expect(buf().get(9, 2)?.char).toBe('A'); // A1a text at graphWidth(2)=9
});

test('a roots swap to a fresh tree resets expand state (new nodes start collapsed)', () => {
  const oldChild = node('old-child');
  const oldRoot = node('old', [oldChild]);
  const roots = signal<TreeNode<string>[]>([oldRoot]);
  const tree = new Tree<string>({ roots, getText: (v) => v });
  const loop = hosted(tree, 20, 6);
  const buf = () => loop.renderRoot.buffer();

  tree.expand(oldRoot); // old tree expanded ⇒ 'old-child' visible on row 1
  loop.renderRoot.flush(); // a direct (non-dispatch) mutation ⇒ force the deferred frame
  expect(buf().get(6, 1)?.char).toBe('o'); // 'old-child' at level 1 (col 6)

  // Swap to a brand-new tree; the previous expansion does not carry over.
  const newChild = node('new-child');
  const newRoot = node('new', [newChild]);
  roots.set([newRoot]);
  loop.renderRoot.flush();
  expect(tree.isExpanded(newRoot)).toBe(false); // fresh node ⇒ collapsed
  // Row 0 is the new (collapsed) root showing the `+` marker; its child is hidden.
  expect(buf().get(0, 0)?.char).toBe('└'); // only root ⇒ corner
  expect(buf().get(2, 0)?.char).toBe('+'); // collapsed-with-children marker
  expect(buf().get(3, 0)?.char).toBe('n'); // 'new' text at col 3
  // No second row of content (child hidden): row 1 is blank normal fill.
  expect(buf().get(3, 1)?.char).toBe(' ');
});

test('an empty forest renders <empty> at column 1 (ListRows parity, PF-003)', () => {
  const roots = signal<TreeNode<string>[]>([]);
  const tree = new Tree<string>({ roots, getText: (v) => v });
  const loop = hosted(tree, 20, 4);
  const buf = () => loop.renderRoot.buffer();
  // '<empty>' begins at column 1.
  expect(buf().get(1, 0)?.char).toBe('<');
  expect([2, 3, 4, 5, 6, 7].map((x) => buf().get(x, 0)?.char).join('')).toBe('empty>');
});

test('the owned ScrollBar reflects the flattened count and follows focus (thumb moves to the end)', () => {
  const children = Array.from({ length: 60 }, (_, i) => node(`f${i}`));
  const roots = signal<TreeNode<string>[]>([node('root', children)]);
  const focused = signal(0);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, expandedByDefault: true });
  const loop = hosted(tree, 20, 8);
  const buf = () => loop.renderRoot.buffer();
  const barX = 19; // rightmost column ([rows fr | bar 1])

  // The bar is drawn: its start arrow (▲) sits at the top of the rightmost column.
  expect(buf().get(barX, 0)?.char).toBe('▲');
  // Thumb (█) near the top when focused at 0.
  expect(buf().get(barX, 1)?.char).toBe('█');

  // Jump focus to the last row (End on a full tree via Ctrl-less End reaches view bottom; use down×N).
  for (let i = 0; i < 60; i += 1) loop.dispatch(key('down'));
  expect(focused()).toBe(60); // 61 rows (root + 60), last index 60
  // The thumb has moved off row 1 toward the bottom (value follows focused via the shared signal).
  expect(buf().get(barX, 1)?.char).not.toBe('█');
  // A `█` thumb still appears somewhere in the lower half of the bar column.
  let lowerThumb = false;
  for (let y = 4; y < 7; y += 1) if (buf().get(barX, y)?.char === '█') lowerThumb = true;
  expect(lowerThumb).toBe(true);
});

// --- Phase 2: navigation + mouse + selection edge cases -----------------------------------------

test('collapsing a focused subtree ancestor re-clamps the focused index into the new range (PA-15)', () => {
  //   A ├ A1 (├ A1a └ A1b) — all expanded ⇒ flatten = [A, A1, A1a, A1b].
  const a1a = node('A1a');
  const a1b = node('A1b');
  const a1 = node('A1', [a1a, a1b]);
  const a = node('A', [a1]);
  const roots = signal<TreeNode<string>[]>([a]);
  const focused = signal(0);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, expandedByDefault: true });
  const loop = hosted(tree, 20, 10);
  focused.set(3); // focus the deepest visible row (A1b)

  // Collapse the ANCESTOR A ⇒ flatten shrinks to [A]; the stale focused index 3 must clamp to 0.
  tree.collapse(a);
  loop.renderRoot.flush();
  expect(focused()).toBe(0);
});

test('wheel scrolls focus by ±3 (jsvision extension)', () => {
  const children = Array.from({ length: 40 }, (_, i) => node(`f${i}`));
  const roots = signal<TreeNode<string>[]>([node('root', children)]);
  const focused = signal(0);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, expandedByDefault: true });
  const loop = hosted(tree, 20, 8);

  loop.dispatch(wheel('down', 1, 1));
  expect(focused()).toBe(3);
  loop.dispatch(wheel('up', 1, 1));
  expect(focused()).toBe(0);
});

test('navigation keys move focus but never select (selected stays -1)', () => {
  const roots = signal<TreeNode<string>[]>([node('X'), node('Y'), node('Z')]);
  const focused = signal(0);
  const selected = signal(-1);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, selected });
  const loop = hosted(tree, 20, 6);

  loop.dispatch(key('down'));
  loop.dispatch(key('down'));
  expect(focused()).toBe(2);
  expect(selected()).toBe(-1); // pure navigation never touches selection
  // The focused row shows the focus bar; no row shows the selected colour.
  const buf = loop.renderRoot.buffer();
  expect(buf.get(0, 2)?.bg).toBe(defaultTheme.outlineFocused.bg);
  expect(buf.get(0, 0)?.bg).toBe(defaultTheme.outlineNormal.bg);
});

test('Enter fires onSelect + emits the command exactly once', () => {
  const roots = signal<TreeNode<string>[]>([node('only')]);
  const focused = signal(0);
  const selected = signal(-1);
  const picks: Array<{ index: number; name: string }> = [];
  const tree = new Tree<string>({
    roots,
    getText: (v) => v,
    focused,
    selected,
    command: 'go',
    onSelect: (index, n) => picks.push({ index, name: n.value }),
  });
  const spy = new CommandSpy();
  const loop = hosted(tree, 20, 6, spy);

  loop.dispatch(key('enter'));
  expect(picks).toEqual([{ index: 0, name: 'only' }]); // onSelect once
  expect(spy.commands).toEqual(['go']); // command emitted once
  expect(selected()).toBe(0);
});

test('Ctrl+PgUp / Ctrl+PgDn jump focus to the first / last flattened row', () => {
  const children = Array.from({ length: 30 }, (_, i) => node(`f${i}`));
  const roots = signal<TreeNode<string>[]>([node('root', children)]);
  const focused = signal(0);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, expandedByDefault: true });
  const loop = hosted(tree, 20, 8);

  loop.dispatch(key('down')); // focused 1
  loop.dispatch({ type: 'key', key: 'pagedown', ctrl: true, alt: false, shift: false });
  expect(focused()).toBe(30); // 31 rows (root + 30) ⇒ last index 30
  loop.dispatch({ type: 'key', key: 'pageup', ctrl: true, alt: false, shift: false });
  expect(focused()).toBe(0);
});
