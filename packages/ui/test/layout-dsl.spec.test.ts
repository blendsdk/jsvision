/**
 * Specification tests (immutable oracles) — the declarative layout builders (col/row/grow/fixed/
 * spacer). Behavioral: they construct real views and assert the resulting `layout` props / child
 * order, and lay out with `reflow`/`RenderRoot` to assert integer bounds. If one fails after
 * implementation, the implementation is wrong.
 *
 * ST-15 lays out a sidebar+main split: its text in the plan reads `col([…])`, but its width
 * assertions are only satisfiable by a horizontal `row` (a `col` stretches children to the full
 * width); the numeric oracle is authoritative, so it is written as `row` (see the ambiguity register).
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, Group, reflow, createRenderRoot } from '../src/view/index.js';
import { col, row, grow, fixed, spacer } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** Minimal concrete leaf view. */
class Leaf extends View {
  draw(): void {
    // no-op — reflow writes bounds; drawing is not under test here
  }
}

// ST-6 — col/row build a Group with the direction set and children added in order.
test('ST-6: col(a, b) → Group direction col, children [a, b]; row(a) → direction row', () => {
  const a = new Leaf();
  const b = new Leaf();
  const c = col(a, b);

  expect(c).toBeInstanceOf(Group);
  expect(c.layout.direction).toBe('col');
  expect(c.children).toEqual([a, b]); // order preserved

  const r = row(a);
  expect(r.layout.direction).toBe('row');
});

// ST-7 — grow/fixed set the child's size token and return the child.
test('ST-7: grow(v,2)→fr:2, grow(v)→fr:1, fixed(v,7)→fixed:7; each returns v', () => {
  const v1 = new Leaf();
  expect(grow(v1, 2)).toBe(v1);
  expect(v1.layout.size).toEqual({ kind: 'fr', weight: 2 });

  const v2 = new Leaf();
  expect(grow(v2)).toBe(v2);
  expect(v2.layout.size).toEqual({ kind: 'fr', weight: 1 }); // default weight 1

  const v3 = new Leaf();
  expect(fixed(v3, 7)).toBe(v3);
  expect(v3.layout.size).toEqual({ kind: 'fixed', cells: 7 });
});

// ST-8 — container shorthand props normalize to the group's own size; explicit `size` wins.
test('ST-8: col shorthand size props (fixed/grow/fill) + explicit size precedence', () => {
  expect(col({ fixed: 20 }).layout.size).toEqual({ kind: 'fixed', cells: 20 });
  expect(col({ grow: 3 }).layout.size).toEqual({ kind: 'fr', weight: 3 });
  expect(col({ fill: true }).layout.size).toEqual({ kind: 'fr', weight: 1 });
  // Explicit `size` wins over the `grow` shorthand.
  expect(col({ size: { kind: 'fixed', cells: 9 }, grow: 5 }).layout.size).toEqual({ kind: 'fixed', cells: 9 });
});

// ST-9 — the `background` prop sets the group's background role (not a layout prop).
test('ST-9: col({ background: "desktop" }) sets group.background', () => {
  const g = col({ background: 'desktop' });
  expect(g.background).toBe('desktop');
  // background is pulled out of the layout props — it is not a layout key.
  expect('background' in g.layout).toBe(false);
});

// ST-10 — spacer as a flexible gap pushes the trailing child to the far edge; a fixed spacer is an
// exact gap.
test('ST-10: flexible spacer pushes B to the right edge; fixed spacer is an exact 4-cell gap', () => {
  const a = new Leaf();
  const b = new Leaf();
  const flexible = row(fixed(a, 6), spacer(), fixed(b, 6));
  reflow(flexible, { width: 30, height: 1 });
  expect(b.bounds.x).toBe(24); // 6 + (30-12) = 24: spacer absorbs all the slack

  const a2 = new Leaf();
  const b2 = new Leaf();
  const fixedGap = row(fixed(a2, 6), spacer({ fixed: 4 }), fixed(b2, 6));
  reflow(fixedGap, { width: 30, height: 1 });
  expect(b2.bounds.x).toBe(10); // 6 + 4 = 10: gap exactly 4 cells
});

// ST-15 — resize correctness: a fixed sidebar + a growing main re-solve on a viewport resize AND on
// a parent-container change (mutate + invalidateLayout, no viewport event).
test('ST-15: sidebar (fixed) + main (grow) re-solve on resize and on a container change', () => {
  const sidebar = new Leaf();
  const main = new Leaf();
  const root = row(fixed(sidebar, 20), grow(main));

  const render = createRenderRoot({ width: 60, height: 16 }, { caps, schedule: (f): void => f() });
  render.mount(root);
  expect(main.bounds.width).toBe(40); // 60 - 20

  render.resize({ width: 40, height: 16 });
  render.flush();
  expect(main.bounds.width).toBe(20); // 40 - 20

  // Change the sidebar's own size and request a reflow — no viewport event.
  fixed(sidebar, 10);
  sidebar.invalidateLayout();
  render.flush();
  expect(main.bounds.width).toBe(30); // 40 - 10
});
