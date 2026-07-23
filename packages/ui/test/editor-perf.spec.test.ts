/**
 * Specification test (immutable oracle) — RD-08 Phase-10 editor performance budget (ST-35).
 *
 * Source: RD-08 AC-20 / AR-261 → ST-35 (codeops/features/jsvision-ui/plans/editor-family/
 * 07-testing-strategy.md). A 1 MB buffer: a single-cluster insert + one coalesced redraw, and a
 * cursor move, each under a 35 ms shared-runner budget — asserted OFF-CI on capable hardware only;
 * under `CI`/`TUI_SKIP_PERF` the numbers log informationally and never gate (the core
 * perf-budget.spec idiom, RD-10 DEF-4 resolution).
 *
 * Trace: RD-08 AC-20 · AR-261 · ST-35.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Editor } from '../src/editor/editor.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const BUDGET_MS = 35;

/** Log-only under CI or an explicit skip (the core perf-budget idiom). */
function logOnly(): boolean {
  return process.env.CI !== undefined || process.env.TUI_SKIP_PERF !== undefined;
}

/**
 * MINIMUM of `n` warmed, timed runs of `fn` — the contention-robust estimator: the full vitest
 * suite runs files in parallel workers, so medians inflate with CPU contention while the min
 * approximates the uncontended per-op cost the AC-20 ceiling is about (never a single sample).
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

test('ST-35: 1 MB buffer — insert+redraw and cursor move each stay under 35 ms (off-CI)', () => {
  const ed = new Editor();
  const root = new Group();
  root.setLayout({ direction: 'col' });
  ed.setLayout({ size: { kind: 'fr', weight: 1 } });
  root.add(ed);
  const loop = createEventLoop({ width: 80, height: 24 }, { caps }); // the dev-box frame (AC-20)
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
