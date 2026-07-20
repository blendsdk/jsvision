/**
 * Specification tests (immutable oracles) — `View.setLayout(patch)`, the merging, self-invalidating
 * write path for layout props. Derived from the requirements, not from observed output: the merge
 * preserves siblings, it is **shallow** (so a discriminated-union `size` swaps atomically), and it
 * always requests a reflow when the view is mounted. If one of these fails after implementation, the
 * implementation is wrong.
 */
import { test, expect } from 'vitest';
import { View, fixed } from '../src/view/index.js';
import type { ViewHost } from '../src/view/index.js';
import { layout } from '../src/layout/index.js';
import type { LayoutBox } from '../src/layout/index.js';

/** Minimal concrete leaf view — only its layout props are under test. */
class Leaf extends View {
  draw(): void {
    // no-op — nothing here paints
  }
}

/**
 * A two-line `ViewHost` double on the public `host` field. It counts `markRelayout` **specifically**:
 * a frame-scheduling counter cannot tell a reflow from a repaint, and telling them apart is the whole
 * point of ST-S3.
 */
function countingHost(): { host: ViewHost; relayouts: () => number } {
  let relayouts = 0;
  return {
    host: {
      markRepaint() {
        // counted separately from relayouts — never conflated
      },
      markRelayout() {
        relayouts += 1;
      },
    },
    relayouts: () => relayouts,
  };
}

// ST-S1 — the merge preserves every prop the patch does not name.
test('ST-S1: setLayout merges, preserving props the patch does not name', () => {
  const v = new Leaf();
  v.layout = { direction: 'col', padding: 1 };
  v.setLayout({ size: { kind: 'fixed', cells: 2 } });
  expect(v.layout).toEqual({ direction: 'col', padding: 1, size: { kind: 'fixed', cells: 2 } });
});

// ST-S2 — the merge is SHALLOW. This test exists to fail if it is ever "improved" to a deep merge:
// a deep merge would leave the previous size variant's `cells` behind alongside the new `weight`.
test('ST-S2: the merge is shallow — a size variant swap leaves no residual fields', () => {
  const v = new Leaf();
  v.layout = { size: { kind: 'fixed', cells: 1 } };
  v.setLayout({ size: { kind: 'fr', weight: 1 } });
  expect(v.layout.size).toEqual({ kind: 'fr', weight: 1 });
});

// ST-S3 — a mounted view reflows. Asserts markRelayout, not "a frame was scheduled".
test('ST-S3: setLayout on a mounted view calls markRelayout', () => {
  const v = new Leaf();
  const { host, relayouts } = countingHost();
  v.host = host;
  v.setLayout({ padding: 1 });
  expect(relayouts()).toBe(1);
});

// ST-S9 — an explicit `undefined` is a supported reset, not an accident of spread semantics: the
// prop is cleared and the engine solves it as that prop's default. Asserted through the public
// solver, so the oracle is pinned to observable layout behaviour rather than to an internal helper.
test('ST-S9: an explicit undefined resets the prop to its layout default', () => {
  const v = new Leaf();
  v.layout = { size: { kind: 'fixed', cells: 2 } };

  v.setLayout({ size: undefined });

  expect(v.layout.size).toBeUndefined();
  // A row container with one child: `fixed 2` would solve to width 2; the default `auto` takes the
  // child's measured width instead.
  const child: LayoutBox = { props: v.layout, children: [], measure: () => ({ width: 7, height: 1 }) };
  const solved = layout({ props: { direction: 'row' }, children: [child] }, { width: 20, height: 3 });
  expect(solved.get(child)?.width).toBe(7);
});

// ST-S5 — applying a DSL tagger to an ALREADY-MOUNTED view requests a reflow. This specifies new
// behaviour rather than witnessing a repaired bug: today a caller must remember to invalidate after
// re-tagging, which is the "set and forget silently doesn't reflow" footgun. Red until the taggers
// route through setLayout.
test('ST-S5: a tagger applied to a mounted view calls markRelayout', () => {
  const v = new Leaf();
  const { host, relayouts } = countingHost();
  v.host = host;

  fixed(v, 2);

  expect(v.layout.size).toEqual({ kind: 'fixed', cells: 2 });
  expect(relayouts()).toBe(1);
});

// ST-S4 — an unmounted view has no host; the call must still merge and must not throw.
test('ST-S4: setLayout on an unmounted view merges without throwing', () => {
  const v = new Leaf();
  v.layout = { direction: 'col' };
  expect(v.host).toBeNull();
  expect(() => v.setLayout({ padding: 1 })).not.toThrow();
  expect(v.layout).toEqual({ direction: 'col', padding: 1 });
});
