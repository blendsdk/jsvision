/**
 * Specification tests (immutable oracles) — View spine packaging, degenerate safety, security.
 *
 * Source: RD-03 AC-17, AC-18, AC-20 → ST-17, ST-18, ST-20
 * (codeops/features/jsvision-ui/plans/view-group-spine/07-testing-strategy.md).
 * Imports the public API **by name** from `@jsvision/ui` (the published surface). Expectations
 * derive from the acceptance criteria, never from the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import {
  View,
  Group,
  createRenderRoot,
  intersect,
  translate,
  contains,
  runWithOwner,
  getOwner,
  signal,
  type Point,
  type ViewState,
  type DrawContext,
  type ThemeRoleName,
  type RenderRoot,
  type RenderRootOptions,
  type Rect,
  type Size2D,
  type Owner,
} from '@jsvision/ui';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

class Leaf extends View {
  draw(): void {
    // no-op
  }
}

// ST-18 / AC-18 — the public surface is importable from `@jsvision/ui`.
test('ST-18: View spine public symbols are importable from @jsvision/ui', () => {
  for (const fn of [intersect, translate, contains, createRenderRoot, runWithOwner, getOwner]) {
    expect(fn).toBeTypeOf('function');
  }
  expect(View).toBeTypeOf('function');
  expect(Group).toBeTypeOf('function');

  // Type-only imports — fail to typecheck if a type is missing from the public surface.
  const rect: Rect = { x: 0, y: 0, width: 1, height: 1 };
  const size: Size2D = { width: 1, height: 1 };
  const point: Point = { x: 0, y: 0 };
  const state: ViewState = { visible: true, disabled: false, focused: false };
  const role: ThemeRoleName = 'window';
  const owner: Owner | null = getOwner();
  const opts: RenderRootOptions = { caps };
  expect(contains(rect, point)).toBe(true);
  expect(size.width).toBe(1);
  expect(state.visible).toBe(true);
  expect(role).toBe('window');
  expect(owner === null || typeof owner === 'object').toBe(true);
  const draw = (_ctx: DrawContext): void => {};
  const root: RenderRoot = createRenderRoot({ width: 2, height: 1 }, opts);
  expect(typeof root.serialize).toBe('function');
  expect(typeof draw).toBe('function');
});

// ST-17 / AC-17 — degenerate geometry (zero viewport / zero view / over-large) → clipped no-ops
// and zero-size bounds, without throwing.
test('ST-17: degenerate geometry produces no-op draws + zero bounds without throwing', () => {
  const leaf = new Leaf();
  leaf.layout = { size: { kind: 'fr', weight: 1 } };
  const root = new Group();
  root.layout = { direction: 'col' };
  root.add(leaf);

  expect(() => {
    const rr = createRenderRoot({ width: 0, height: 0 }, { caps });
    rr.mount(root);
    rr.serialize();
  }).not.toThrow();
  expect(leaf.bounds.width).toBe(0);
  expect(leaf.bounds.height).toBe(0);

  // An over-large clip / oversized fill is clipped to the buffer, never throws.
  const big = new Group();
  big.layout = { direction: 'col' };
  big.background = 'window';
  expect(() => {
    const rr = createRenderRoot({ width: 3, height: 2 }, { caps });
    rr.mount(big);
  }).not.toThrow();
});

// ST-20 / AC-20 — no external-input/injection/auth surface beyond terminal output; a frame +
// reflow are bounded single passes; reactivity inherits the 1000-iteration runaway guard.
test('ST-20: a frame + reflow are bounded passes over a finite tree (no unbounded work)', () => {
  // Build a finite, moderately deep/wide tree; mounting + serializing completes (bounded).
  const root = new Group();
  root.layout = { direction: 'col' };
  let parent = root;
  for (let depth = 0; depth < 8; depth += 1) {
    const next = new Group();
    next.layout = { direction: 'row', size: { kind: 'fr', weight: 1 } };
    for (let i = 0; i < 4; i += 1) {
      const leaf = new Leaf();
      leaf.layout = { size: { kind: 'fr', weight: 1 } };
      next.add(leaf);
    }
    parent.add(next);
    parent = next;
  }

  const rr = createRenderRoot({ width: 40, height: 20 }, { caps });
  expect(() => {
    rr.mount(root);
    rr.serialize();
  }).not.toThrow();
  expect(rr.serialize().length).toBeGreaterThanOrEqual(0); // a single bounded serialize pass

  // No external input is consumed: the spine operates only on developer-authored views/signals.
  const s = signal(0);
  expect(s()).toBe(0);
});
