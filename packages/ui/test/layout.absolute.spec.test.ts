/**
 * Specification tests (immutable oracles) — RD-02 absolute placement (RD-05 Phase 0).
 *
 * FX-01…FX-04 derive from the App-Shell foundation-extensions spec
 * (codeops/features/jsvision-ui/plans/app-shell/03-00-foundation-extensions.md §A / PA-15) and the
 * testing strategy (07-testing-strategy.md). They assert the additive `position:'absolute'` + `rect`
 * placement mode through the public `layout()` function — never from reading the implementation. If
 * one fails after implementation, the implementation is wrong.
 *
 * Trace: RD-05 03-00 §A · PA-15 · FX-01…FX-04.
 */
import { test, expect } from 'vitest';
import { layout, type LayoutBox } from '../src/layout/index.js';

// FX-01 — an absolute child is placed at its rect; the flow sibling is sized/placed as if the
// absolute child were absent (flow reserves no space for it).
test('FX-01: absolute child at its rect; flow sibling reserves no space for it', () => {
  const absChild: LayoutBox = {
    props: { position: 'absolute', rect: { x: 2, y: 0, width: 3, height: 1 } },
    children: [],
  };
  const flowChild: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const root: LayoutBox = { props: { direction: 'row' }, children: [absChild, flowChild] };

  const result = layout(root, { width: 10, height: 2 });

  // The flow child fills the full content width — the absolute child consumes no main-axis space.
  expect(result.get(flowChild)?.x).toBe(0);
  expect(result.get(flowChild)?.width).toBe(10);
  // The absolute child sits at its content-box-relative rect (root has no padding → origin 0,0).
  expect(result.get(absChild)).toEqual({ x: 2, y: 0, width: 3, height: 1 });
});

// FX-02 — two absolute children whose rects overlap both keep their full rects (overlap allowed).
test('FX-02: two absolute children may overlap; both keep their full rects', () => {
  const a: LayoutBox = { props: { position: 'absolute', rect: { x: 0, y: 0, width: 5, height: 3 } }, children: [] };
  const b: LayoutBox = { props: { position: 'absolute', rect: { x: 2, y: 1, width: 5, height: 3 } }, children: [] };
  const root: LayoutBox = { props: {}, children: [a, b] };

  const result = layout(root, { width: 10, height: 5 });

  expect(result.get(a)).toEqual({ x: 0, y: 0, width: 5, height: 3 });
  expect(result.get(b)).toEqual({ x: 2, y: 1, width: 5, height: 3 });
  // The rects overlap (b's top-left (2,1) lies inside a's 5×3 box) and neither is shrunk.
});

// FX-03 — an absolute child's own children flow within the child's rect, padding honored.
test('FX-03: absolute child flows its own children within its rect, padding honored', () => {
  const inner1: LayoutBox = { props: { size: { kind: 'fixed', cells: 2 } }, children: [] };
  const inner2: LayoutBox = { props: { size: { kind: 'fixed', cells: 3 } }, children: [] };
  const absChild: LayoutBox = {
    props: { position: 'absolute', rect: { x: 1, y: 1, width: 10, height: 5 }, direction: 'row', padding: 1 },
    children: [inner1, inner2],
  };
  const root: LayoutBox = { props: {}, children: [absChild] };

  const result = layout(root, { width: 20, height: 10 });

  // The absolute child is placed at its rect.
  expect(result.get(absChild)).toEqual({ x: 1, y: 1, width: 10, height: 5 });
  // Its children flow within the child's content box (padding 1 → content origin at 1,1).
  expect(result.get(inner1)?.x).toBe(1);
  expect(result.get(inner1)?.y).toBe(1);
  expect(result.get(inner1)?.width).toBe(2);
  expect(result.get(inner2)?.x).toBe(3); // padding.left (1) + inner1 width (2)
  expect(result.get(inner2)?.width).toBe(3);
});

// FX-04 — re-laying out at a new viewport (resize) re-honors each absolute rect — no flex snap-back.
test('FX-04: re-layout at a new viewport re-honors the absolute rect (no flex snap-back)', () => {
  const flowChild: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const absChild: LayoutBox = {
    props: { position: 'absolute', rect: { x: 3, y: 2, width: 4, height: 2 } },
    children: [],
  };
  const root: LayoutBox = { props: {}, children: [flowChild, absChild] };

  const r1 = layout(root, { width: 20, height: 10 });
  expect(r1.get(absChild)).toEqual({ x: 3, y: 2, width: 4, height: 2 });

  const r2 = layout(root, { width: 40, height: 20 });
  // The absolute rect is unchanged by the resize.
  expect(r2.get(absChild)).toEqual({ x: 3, y: 2, width: 4, height: 2 });
  // The flow child re-flexes to the new viewport width.
  expect(r2.get(flowChild)?.width).toBe(40);
});
