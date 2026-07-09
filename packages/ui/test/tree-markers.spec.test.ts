/**
 * Specification tests (immutable oracles) — the opt-in Tree `markerStyle` (`'tv' | 'brackets' |
 * 'triangle'`), covering the pure `createGraph`/`graphWidth` style parameter, the no-Unicode
 * fallback, and a composed `Tree` render (ST-1…ST-8).
 *
 * Expectations derive from the requirement + the marker-style glyph table only, never from the
 * implementation:
 *   • `'tv'` (default): collapsed `+`, expanded/leaf `─`; end graphic width 3.
 *   • `'brackets'`: collapsed `[+]`, expanded `[-]`, leaf `   ` (3 spaces); end graphic width 5.
 *   • `'triangle'`: collapsed `▸`, expanded `▾`, leaf ` ` (1 space); end graphic width 3; degrades
 *     to `'brackets'` when the terminal has no Unicode.
 *
 * The `'tv'` path stays byte-identical to today — `tree-graph.spec.test.ts` and
 * `fidelity.tree.spec.test.ts` remain the untouched `'tv'` oracle. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createGraph, graphWidth, OV_EXPANDED, OV_CHILDREN } from '../src/tree/graph.js';
import type { TreeNode } from '../src/tree/index.js';
import { Tree } from '../src/tree/index.js';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import type { MouseEvent as CoreMouseEvent } from '@jsvision/core';

// utf8:false (default env) — the fallback profile; utf8:true needs a UTF-8 locale.
const noUnicodeCaps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;
const unicodeCaps = resolveCapabilities({
  env: { LANG: 'en_US.UTF-8' },
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

/** The display-order code points of a graph string (all glyphs are width-1). */
function cells(graph: string): string[] {
  return [...graph];
}
function node<T>(value: T, children: TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** Mount a Tree filling `w×h` under a root Group, focus its rows renderer; caps selectable. */
function hosted<T>(tree: Tree<T>, w: number, h: number, caps = noUnicodeCaps) {
  tree.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(tree);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  loop.focusView(tree.rows);
  return loop;
}

// --- createGraph / graphWidth per style (ST-1…ST-5) --------------------------------------------

test('ST-1: createGraph with no style arg is byte-identical to the `tv` default (collapsed `+`, expanded `─`)', () => {
  // Collapsed root with children ⇒ `+`; a level-0 leaf/expanded ⇒ `─`. Width 3, no brackets.
  const collapsed = createGraph(0, 0, OV_CHILDREN);
  expect(cells(collapsed)).toEqual(['├', '─', '+']);
  const expanded = createGraph(0, 0, OV_CHILDREN | OV_EXPANDED);
  expect(cells(expanded)).toEqual(['├', '─', '─']);
  // Explicit 'tv' equals the default.
  expect(createGraph(0, 0, OV_CHILDREN, true, 'tv')).toBe(collapsed);
});

test('ST-2: brackets — collapsed ends `[+]`, expanded ends `[-]`', () => {
  const collapsed = createGraph(0, 0, OV_CHILDREN, true, 'brackets');
  expect(collapsed.endsWith('[+]')).toBe(true);
  expect(cells(collapsed)).toEqual(['├', '─', '[', '+', ']']);
  const expanded = createGraph(0, 0, OV_CHILDREN | OV_EXPANDED, true, 'brackets');
  expect(expanded.endsWith('[-]')).toBe(true);
});

test('ST-3: brackets — a leaf marker is 3 blank cells, keeping column alignment', () => {
  // A leaf carries OV_EXPANDED but not OV_CHILDREN ⇒ blank marker (no `[-]`).
  const leaf = createGraph(0, 0, OV_EXPANDED, true, 'brackets');
  expect(cells(leaf)).toEqual(['├', '─', ' ', ' ', ' ']);
  expect(leaf).not.toContain('[');
  // Same total width as a bracket-marked node ⇒ alignment preserved.
  expect(cells(leaf)).toHaveLength(cells(createGraph(0, 0, OV_CHILDREN, true, 'brackets')).length);
});

test('ST-4: triangle — collapsed `▸`, expanded `▾`, leaf single space', () => {
  expect([...createGraph(0, 0, OV_CHILDREN, true, 'triangle')].at(-1)).toBe('▸');
  expect([...createGraph(0, 0, OV_CHILDREN | OV_EXPANDED, true, 'triangle')].at(-1)).toBe('▾');
  const leaf = createGraph(0, 0, OV_EXPANDED, true, 'triangle');
  expect([...leaf].at(-1)).toBe(' ');
  expect(cells(leaf)).toHaveLength(3); // width 3, same as `tv`
});

test('ST-5: graphWidth — brackets is `level*3+5`; tv/triangle are `level*3+3`', () => {
  for (const level of [0, 1, 3]) {
    expect(graphWidth(level, 'brackets')).toBe(level * 3 + 5);
    expect(graphWidth(level, 'tv')).toBe(level * 3 + 3);
    expect(graphWidth(level, 'triangle')).toBe(level * 3 + 3);
    expect(graphWidth(level)).toBe(level * 3 + 3); // default stays tv
  }
});

// --- hit-zone + render (ST-6…ST-8) -------------------------------------------------------------

test('ST-6: a mouse click within the wider bracket graph-zone toggles the collapsed node', () => {
  const child = node('child');
  const roots = signal<TreeNode<string>[]>([node('root', [child])]);
  const tree = new Tree<string>({ roots, getText: (v) => v, markerStyle: 'brackets' });
  const loop = hosted(tree, 24, 6);
  expect(tree.isExpanded(roots()[0])).toBe(false);

  // Mouse coords are 1-based; (5,1) ⇒ view-local (4,0). graphWidth(0,'brackets') = 5, so local x=4 is
  // inside the wider bracket zone (past the tv width 3) ⇒ toggles. Under 'tv' x=4 would be text.
  loop.dispatch(mouse('down', 5, 1));
  loop.dispatch(mouse('up', 5, 1));
  expect(tree.isExpanded(roots()[0])).toBe(true);
});

test('ST-7: markerStyle `triangle` under a no-Unicode terminal renders as brackets, not `▸`/`▾`', () => {
  const child = node('child');
  const roots = signal<TreeNode<string>[]>([node('root', [child])]);
  const tree = new Tree<string>({ roots, getText: (v) => v, markerStyle: 'triangle', expandedByDefault: true });
  const loop = hosted(tree, 24, 6, noUnicodeCaps);
  const buf = loop.renderRoot.buffer();
  // Root row 0 (expanded-with-children): brackets fallback ⇒ `[-]` ending at graphWidth-1.
  const w = graphWidth(0, 'brackets');
  expect(buf.get(w - 3, 0)?.char).toBe('[');
  expect(buf.get(w - 1, 0)?.char).toBe(']');
  // No triangle glyph anywhere on the row.
  for (let x = 0; x < 24; x += 1) expect(['▸', '▾']).not.toContain(buf.get(x, 0)?.char);
});

test('ST-8: triangle under a Unicode terminal draws `▸`/`▾`; brackets composes `[+]`/`[-]`', () => {
  const child = node('child');
  // Triangle + Unicode ⇒ real triangles.
  const triRoots = signal<TreeNode<string>[]>([node('root', [child])]);
  const tri = new Tree<string>({ roots: triRoots, getText: (v) => v, markerStyle: 'triangle' });
  const triLoop = hosted(tri, 24, 6, unicodeCaps);
  expect(triLoop.renderRoot.buffer().get(graphWidth(0, 'triangle') - 1, 0)?.char).toBe('▸'); // collapsed

  // Brackets composes `[+]` for a collapsed root, `[-]` once expanded.
  const brRoots = signal<TreeNode<string>[]>([node('root', [child])]);
  const br = new Tree<string>({ roots: brRoots, getText: (v) => v, markerStyle: 'brackets' });
  const brLoop = hosted(br, 24, 6, noUnicodeCaps);
  const w = graphWidth(0, 'brackets');
  expect(brLoop.renderRoot.buffer().get(w - 3, 0)?.char).toBe('['); // `[+]`
  expect(brLoop.renderRoot.buffer().get(w - 2, 0)?.char).toBe('+');
});
