/**
 * Implementation tests (edges/internals, written after the spec is green) for the Tree `markerStyle`:
 * deep-level bracket geometry + column alignment, the `guides=false` width parity per style, the leaf
 * blank widths, and the mouse toggle-zone tracking the wider bracket graphic. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { createGraph, graphWidth, OV_EXPANDED, OV_CHILDREN, OV_LAST } from '../src/tree/graph.js';
import type { TreeNode } from '../src/tree/index.js';
import { Tree } from '../src/tree/index.js';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function cells(g: string): string[] {
  return [...g];
}
function node<T>(value: T, children: TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}
function mouse(kind: 'down' | 'up', x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

test('brackets geometry at a deep level: full width = level*3 + 6, marker `[+] ` at the tail', () => {
  // Level 3, collapsed-with-children, all ancestors continued ⇒ `│  │  │  ├─[+] `.
  const g = createGraph(3, 0b111, OV_CHILDREN, true, 'brackets');
  expect(cells(g)).toHaveLength(graphWidth(3, 'brackets', OV_CHILDREN)); // 3*3 + 2 + 4 = 15
  expect(g.endsWith('├─[+] ')).toBe(true);
  expect(cells(g).slice(0, 9)).toEqual(['│', ' ', ' ', '│', ' ', ' ', '│', ' ', ' ']);
});

test('a leaf prefix collapses to one trailing cell; brackets/triangle branches are wider (ragged)', () => {
  // Every style's leaf is 3 cells: fork/corner + fill + one marker-or-space cell.
  const brLeaf = createGraph(0, 0, OV_EXPANDED | OV_LAST, true, 'brackets');
  expect(cells(brLeaf)).toEqual(['└', '─', ' ']); // just the single separating space, no `[…]`
  const triLeaf = createGraph(0, 0, OV_EXPANDED | OV_LAST, true, 'triangle');
  expect(cells(triLeaf)).toEqual(['└', '─', ' ']);
  expect([...createGraph(0, 0, OV_EXPANDED | OV_LAST, true, 'tv')].at(-1)).toBe('─'); // tv leaf is flush `─`
  // A marked (collapsed) node is wider than the leaf in brackets/triangle ⇒ ragged text columns.
  expect(cells(createGraph(0, 0, OV_CHILDREN, true, 'brackets')).length).toBeGreaterThan(cells(brLeaf).length);
  expect(cells(createGraph(0, 0, OV_CHILDREN, true, 'triangle')).length).toBeGreaterThan(cells(triLeaf).length);
});

test('guides=false keeps the per-style width and marker, dropping only the connectors', () => {
  for (const style of ['tv', 'brackets', 'triangle'] as const) {
    const on = createGraph(2, 0b11, OV_CHILDREN, true, style);
    const off = createGraph(2, 0b11, OV_CHILDREN, false, style);
    expect(cells(off)).toHaveLength(cells(on).length); // width parity
    // Slice off the marker field (brackets `[+] `=4, triangle `▸ `=2, tv `+`=1) ⇒ the rest is all spaces.
    const markerLen = style === 'brackets' ? 4 : style === 'triangle' ? 2 : 1;
    expect(/[│├└─]/.test(off.slice(0, cells(off).length - markerLen))).toBe(false);
  }
  // The bracket marker (with its trailing space) survives guides=false.
  expect(createGraph(1, 0, OV_CHILDREN, false, 'brackets').endsWith('[+] ')).toBe(true);
});

test('mouse toggle-zone tracks the widened bracket graphic across levels', () => {
  // A nested tree; expand the root so a level-1 child is visible, then click its wider bracket zone.
  const leaf = node('leaf');
  const child = node('child', [leaf]);
  const roots = signal<TreeNode<string>[]>([node('root', [child])]);
  const tree = new Tree<string>({ roots, getText: (v) => v, markerStyle: 'brackets', expandedByDefault: false });
  tree.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 30, height: 8 } };
  const root = new Group();
  root.add(tree);
  const loop = createEventLoop({ width: 30, height: 8 }, { caps });
  loop.mount(root);
  loop.focusView(tree.rows);

  // Expand root (click its zone at level 0): local (4,0) ⇒ 1-based (5,1).
  loop.dispatch(mouse('down', 5, 1));
  loop.dispatch(mouse('up', 5, 1));
  expect(tree.isExpanded(roots()[0])).toBe(true);

  // Now 'child' is on row 1 at level 1; graphWidth(1,'brackets',collapsed) = 9. Local x=7 (1-based 8) is inside.
  loop.dispatch(mouse('down', 8, 2));
  loop.dispatch(mouse('up', 8, 2));
  expect(tree.isExpanded(child)).toBe(true);
});

test('the default (no markerStyle) stays `tv`: a collapsed root composes a bare `+`', () => {
  const roots = signal<TreeNode<string>[]>([node('root', [node('c')])]);
  const tree = new Tree<string>({ roots, getText: (v) => v });
  tree.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 6 } };
  const root = new Group();
  root.add(tree);
  const loop = createEventLoop({ width: 20, height: 6 }, { caps });
  loop.mount(root);
  const buf = loop.renderRoot.buffer();
  expect(buf.get(2, 0)?.char).toBe('+'); // graphWidth(0,'tv')-1 = 2
  expect(buf.get(0, 0)?.char).toBe('└'); // single root ⇒ corner
});
