/**
 * Specification test (immutable oracle) — RD-15 Tree TV fidelity, GATE-2 AFTER-diff (ST-21).
 *
 * Per the NON-NEGOTIABLE fidelity directive, this re-opens `magiblot/tvision` `source/tvision/
 * toutline.cpp` / `include/tvision/outline.h` and diffs our composed buffer (pre-`serialize`)
 * cell-by-cell against the decode. The C++ is the oracle; a disagreement is OUR defect.
 *
 * Decode re-verified here (cite `file:line`):
 *   • **graph glyphs + widths** — `graphChars="\x20\xB3\xC3\xC0\xC4\xC4+\xC4"` (`:367`), `levelWidth=
 *     endWidth=3` (`:366`); `createGraph` (`:165-205`) = per ancestor level `[│/space][2 fillers]`,
 *     then the 3-col end graphic `[fork/corner][─][marker]`. Fork `├` non-last / corner `└` last
 *     (`:190`); marker `expanded ? '─' : '+'` (`:200`) — a collapsed-with-children node shows `+`, a
 *     leaf/expanded node `─`. No `[+]`/`[-]` brackets.
 *   • **two-tone text** — `c = (flags & ovExpanded) ? color : (color >> 8)` (`:82`): a collapsed normal
 *     node's text = high byte = `outlineNotExpanded`; an expanded/leaf normal node's = low byte =
 *     `outlineNormal`. Graph prefix is drawn in the ROW colour (`:73-79`).
 *   • **row colour** — focused `getColor(0x0202)` > selected `getColor(0x0303)` > normal
 *     `getColor(0x0401)` (`:66-71`) → the 4 blue-window-decoded roles (PA-16): normal `0x1E`
 *     yellow-on-blue, focused `0x71` blue-on-lightGray, selected `0x1A` brightGreen-on-blue,
 *     notExpanded `0x1F` white-on-blue.
 *
 * (The behavioural halves of the decode — mouse graph-zone toggle vs text select `:433-481`, and
 * `+`/`-`/`*`/arrow semantics `:484-539` — are diffed in `tree.spec` ST-12…ST-19; this file covers the
 * drawing.) `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { Tree } from '../src/tree/index.js';
import type { TreeNode } from '../src/tree/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function node<T>(value: T, children: TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}

//   A (expanded, non-last root)
//   │  A1 (collapsed-with-child, non-last)
//   │  A2 (leaf, last child)
//   B  (leaf, last root)
// Fixed structure with a mix of expanded/collapsed/leaf and last/non-last at two levels.
function fixture(focused: Signal<number>, selected: Signal<number>) {
  const a1 = node('A1', [node('A1a')]);
  const a2 = node('A2');
  const a = node('A', [a1, a2]);
  const b = node('B');
  const roots = signal<TreeNode<string>[]>([a, b]);
  const tree = new Tree<string>({ roots, getText: (v) => v, focused, selected });
  tree.expand(a); // A expanded; A1 stays collapsed
  tree.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 6 } });
  const root = new Group();
  root.add(tree);
  const loop = createEventLoop({ width: 20, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(tree.rows);
  return loop.renderRoot.buffer();
}

/** Read the graph-prefix cells `[0, count)` of a row as chars. */
function graphCells(buf: ReturnType<typeof fixture>, y: number, count: number): string[] {
  const out: string[] = [];
  for (let x = 0; x < count; x += 1) out.push(buf.get(x, y)?.char ?? ' ');
  return out;
}

test('ST-21: graph glyphs + widths match createGraph cell-by-cell (fork/corner, │ ancestor, +/─ marker)', () => {
  const buf = fixture(signal(3), signal(-1)); // focus B (row 3), nothing selected

  // Row 0 — A: expanded, non-last root ⇒ `├──` (fork + filler + expanded marker ─); text at col 3.
  expect(graphCells(buf, 0, 3)).toEqual(['├', '─', '─']);
  expect(buf.get(3, 0)?.char).toBe('A');

  // Row 1 — A1: collapsed-with-children, non-last child ⇒ `│  ├─+`; text at col 6 (graphWidth(1)).
  expect(graphCells(buf, 1, 6)).toEqual(['│', ' ', ' ', '├', '─', '+']);
  expect(buf.get(6, 1)?.char).toBe('A'); // 'A1'

  // Row 2 — A2: leaf, last child ⇒ `│  └──` (corner + leaf marker ─).
  expect(graphCells(buf, 2, 6)).toEqual(['│', ' ', ' ', '└', '─', '─']);
  expect(buf.get(6, 2)?.char).toBe('A'); // 'A2'

  // Row 3 — B: leaf, last root ⇒ `└──`; text at col 3.
  expect(graphCells(buf, 3, 3)).toEqual(['└', '─', '─']);
  expect(buf.get(3, 3)?.char).toBe('B');

  // No `[+]`/`[-]` brackets anywhere.
  let all = '';
  for (let y = 0; y < 6; y += 1) for (let x = 0; x < 20; x += 1) all += buf.get(x, y)?.char ?? ' ';
  expect(all).not.toContain('[');
  expect(all).not.toContain(']');
});

test('ST-21: two-tone text — collapsed normal = outlineNotExpanded, expanded/leaf normal = outlineNormal', () => {
  const buf = fixture(signal(3), signal(-1)); // A/A1/A2 are all normal (unfocused, unselected)

  // A (row 0, expanded normal) text ⇒ low byte outlineNormal (yellow).
  expect(buf.get(3, 0)?.fg).toBe(defaultTheme.outlineNormal.fg);
  // A1 (row 1, COLLAPSED normal) text ⇒ high byte outlineNotExpanded (white) — the two-tone split.
  expect(buf.get(6, 1)?.fg).toBe(defaultTheme.outlineNotExpanded.fg);
  // A2 (row 2, leaf ⇒ ovExpanded) text ⇒ outlineNormal (yellow), NOT notExpanded.
  expect(buf.get(6, 2)?.fg).toBe(defaultTheme.outlineNormal.fg);
  // The graph prefix stays in the row colour (outlineNormal) even on the collapsed A1 row.
  expect(buf.get(0, 1)?.fg).toBe(defaultTheme.outlineNormal.fg);
  // The two tones genuinely differ.
  expect(defaultTheme.outlineNormal.fg).not.toBe(defaultTheme.outlineNotExpanded.fg);
});

test('ST-21: the 4 resolved outline colours match the blue-window getColor decode (PA-16)', () => {
  // Normal + focused in one render (focus B), selected in a second (select A) — all 4 roles covered.
  const buf1 = fixture(signal(3), signal(-1));
  // Normal row (A) bg = outlineNormal.bg (blue).
  expect(buf1.get(0, 0)?.bg).toBe(defaultTheme.outlineNormal.bg);
  // Focused row (B) = outlineFocused: distinct inverted bar (blue-on-lightGray), NOT equal to normal.
  expect(buf1.get(0, 3)?.bg).toBe(defaultTheme.outlineFocused.bg);
  expect(buf1.get(3, 3)?.fg).toBe(defaultTheme.outlineFocused.fg);
  expect(defaultTheme.outlineFocused.bg).not.toBe(defaultTheme.outlineNormal.bg); // focus is visible

  const buf2 = fixture(signal(3), signal(0)); // select A (row 0), focus B
  // Selected row (A) = outlineSelected (brightGreen-on-blue).
  expect(buf2.get(0, 0)?.bg).toBe(defaultTheme.outlineSelected.bg);
  expect(buf2.get(3, 0)?.fg).toBe(defaultTheme.outlineSelected.fg);
});
