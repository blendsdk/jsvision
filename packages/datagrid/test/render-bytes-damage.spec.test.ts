/**
 * Specification test (immutable oracle) — bytes ∝ damage at the grid level (ST-5, RD-14 AC-2 2nd half).
 *
 * `serialize` is a damage diff, so a single-cell change must re-serialize only the damaged region: its
 * byte count is proportional to the cells that actually changed, not to the screen area. The oracle is
 * a RATIO (single-cell diff `< full-first-paint / 10`), not an absolute count, so it is deterministic
 * and machine-independent — mirroring core's `render-bytes-damage.spec.test.ts`.
 *
 * The buffers are snapshotted explicitly (`buffer().clone()`) and diffed with core's standalone
 * `serialize`, rather than reading `rr.serialize()`: the grid schedules a reactive post-mount repaint,
 * so the render root's own cached last-frame diff is not a reliable "full first paint" here. `full` is
 * `serialize(base, null)`; `diff` is `serialize(after, base)`. `String.length` matches core's oracle.
 */
import { test, expect } from 'vitest';
import { serialize, resolveCapabilities } from '@jsvision/core';
import type { RenderOptions } from '@jsvision/core';
import { buildPerfGrid } from './fixtures/perf-grid.js';

const OPTS: RenderOptions = {
  caps: resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile,
};

test('ST-5: a single-cell change re-serializes only the damaged region (bytes ∝ damage)', () => {
  const g = buildPerfGrid();
  g.rr.flush(); // settle the composed frame
  const base = g.rr.buffer().clone(); // exact snapshot of the full frame

  const full = serialize(base, null, OPTS).length; // the full first paint
  expect(full, 'the full first paint emits bytes').toBeGreaterThan(0);

  // Change exactly one cell's value (row 0's name), recompose, and diff against the snapshot.
  const next = g.rows().map((r, i) => (i === 0 ? { ...r, name: `${r.name}!` } : r));
  g.rows.set(next);
  g.rr.flush();
  const diff = serialize(g.rr.buffer(), base, OPTS).length;

  expect(diff, 'a single-cell change must emit some bytes').toBeGreaterThan(0);
  expect(diff < full / 10, `single-cell diff ${diff} must be < full/10 (${full / 10})`).toBeTruthy();
});
