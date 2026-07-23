/**
 * Specification test (immutable oracle) — editor performance budget.
 *
 * A 1 MB buffer: a single-cluster insert plus one coalesced redraw, and a cursor
 * move, each under the 16 ms frame ceiling. Contended environments log the
 * measurements instead of enforcing them.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { perfBudgetMode } from '../../core/bench/frame-bench.mjs';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Editor } from '../src/editor/editor.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const BUDGET_MS = 16;

/** Log-only when wall-clock contention makes the budget unreliable. */
function logOnly(): boolean {
  return perfBudgetMode(process.env) === 'log';
}

/**
 * MINIMUM of `n` warmed, timed runs of `fn` — the contention-robust estimator: the full vitest
 * suite runs files in parallel workers, so medians inflate with CPU contention while the min
 * approximates the uncontended per-operation cost (never a single sample).
 */
function minTime(n: number, fn: () => void): number {
  fn(); // warm
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    fn();
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

test('ST-35: 1 MB buffer — insert+redraw and cursor move each stay under 16 ms in serial runs', () => {
  const ed = new Editor();
  const root = new Group();
  root.setLayout({ direction: 'col' });
  ed.setLayout({ size: { kind: 'fr', weight: 1 } });
  root.add(ed);
  const loop = createEventLoop({ width: 80, height: 24 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  loop.focusView(ed);

  // ~1 MB: 16384 lines × 64 chars (63 + \n).
  const line = 'x'.repeat(63);
  ed.setText(Array.from({ length: 16384 }, () => line).join('\n'));
  ed.execute('textEnd');
  loop.renderRoot.flush();

  const insertMs = minTime(15, () => {
    ed.typeText('y', false);
    loop.renderRoot.flush(); // the coalesced redraw
  });
  const moveMs = minTime(15, () => {
    ed.execute('lineUp');
    loop.renderRoot.flush();
  });

  if (logOnly()) {
    console.log(`editor perf (informational): insert+redraw ${insertMs.toFixed(2)}ms, move ${moveMs.toFixed(2)}ms`);
    return;
  }
  expect(insertMs).toBeLessThan(BUDGET_MS);
  expect(moveMs).toBeLessThan(BUDGET_MS);
});
