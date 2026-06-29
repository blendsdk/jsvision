/**
 * Specification test (immutable oracle) — ScreenBuffer.clone() exactness.
 *
 * Source: RD-03 plan PA-8 / AR-44 → ST-22
 * (codeops/features/jsvision-ui/plans/view-group-spine/07-testing-strategy.md).
 * RD-03's partial recompose (AC-7) diffs the next frame against a faithful snapshot
 * of the previous one; clone() must reproduce every cell exactly — including a wide
 * glyph's lead (width 2) and continuation (width 0) cells — or serialize() would emit
 * spurious damage. Expectations derive from the plan's clone() contract, never from
 * the implementation.
 *
 * The `.js` extension on the engine import is required by NodeNext ESM resolution
 * (resolved to source at run time).
 */
import { test, expect } from 'vitest';
import { ScreenBuffer, serialize, resolveCapabilities, Attr } from '../src/engine/index.js';

// Truecolor caps: the widest encoding path, so any cell difference would surface in the diff.
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;
const OPTS = { caps };

// ST-22 / PA-8, AR-44 — clone() is a deep, exact, independent copy of the buffer.
test('ST-22: clone() deep-copies dims + every cell (incl. a wide glyph) → empty diff vs the original', () => {
  const buf = new ScreenBuffer(8, 2, { fg: 'default', bg: 'default' });
  buf.text(0, 0, 'Hi', { fg: 'red', bg: 'default', attrs: Attr.bold }); // styled ASCII run
  buf.text(0, 1, '世界', { fg: 'green', bg: 'default' }); // wide glyphs: lead (width 2) + continuation (width 0)

  const clone = buf.clone();

  // (c) dims match.
  expect(clone.width).toBe(buf.width);
  expect(clone.height).toBe(buf.height);

  // (a) exact cell-for-cell equality — serialize emits an EMPTY diff, including the
  //     wide-lead and continuation cells (a width mismatch there would emit spurious runs).
  expect(serialize(clone, buf, OPTS)).toBe('');

  // (b) independence — mutating the clone does not change the original.
  clone.set(0, 0, 'Z', { fg: 'blue', bg: 'default' });
  expect(serialize(clone, buf, OPTS)).not.toBe(''); // the copies now differ
  expect(buf.get(0, 0)?.char).toBe('H'); // original untouched
  expect(clone.get(0, 0)?.char).toBe('Z'); // only the clone changed
});
