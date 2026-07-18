/**
 * Specification test (immutable oracle) — the representative frame-budget bench (ST-4, RD-14 AC-1).
 *
 * A 60×22 editable grid's compose+diff MEDIAN over warmed iterations is within the 16 ms frame budget
 * off-CI; under `CI` / `TUI_SKIP_PERF` the assertion is skipped and the median + p95 are logged (wall-
 * clock timing is environment-sensitive). Mirrors core's `perf-budget.spec.test.ts` discipline and
 * reuses its pure `median` / `p95` / `perfBudgetMode` helpers.
 *
 * The metric is compose+diff, NOT view construction or layout (PF-005): the grid + render root are
 * built ONCE, outside the timed region; each iteration forces a full recompose via `setTheme` (which
 * changes no geometry, so layout is not re-run) and then serializes the frame. `serialize().length` is
 * folded into a sink so the measured work can't be dead-code-eliminated.
 *
 * This spec imports core's cross-package `.mjs` bench helpers by workspace-relative path; that resolves
 * at run time (vitest/tsx) but is excluded from datagrid's typecheck (see tsconfig.typecheck).
 */
import { test, expect } from 'vitest';
import { serialize, resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { RenderOptions } from '@jsvision/core';
import { median, p95, perfBudgetMode } from '../../core/bench/frame-bench.mjs';
import { buildPerfGrid } from './fixtures/perf-grid.js';

/** RD-14 AC-1: the same 16 ms ceiling core asserts for its 200×50 frame. */
const BUDGET_MS = 16;
/** Median is taken over this many warmed iterations — never a single sample. */
const ITER = 200;
/** Warm-up iterations discarded before timing (let the JIT settle). */
const WARMUP = 20;
/** Truecolor — the widest encoder path, a worst case for the serialized byte count. */
const OPTS: RenderOptions = {
  caps: resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile,
};

/** A sink to keep the measured work observable so it can't be optimized away. */
let sink = 0;

/** Per-iteration compose+diff durations (ms) for the 60×22 grid, over warmed iterations. */
function sampleGridComposeDiff(): number[] {
  const g = buildPerfGrid(); // construction + first layout OUTSIDE the timed region (PF-005)
  // Force a full recompose (no geometry change → no re-layout), compose the frame, then full-serialize it.
  const measure = (): string => {
    g.rr.setTheme(defaultTheme);
    g.rr.flush();
    return serialize(g.rr.buffer(), null, OPTS);
  };
  for (let i = 0; i < WARMUP; i += 1) sink += measure().length;
  const samples = new Array<number>(ITER);
  for (let i = 0; i < ITER; i += 1) {
    const t0 = performance.now();
    sink += measure().length;
    samples[i] = performance.now() - t0;
  }
  return samples;
}

test('ST-4: 60x22 representative grid compose+diff median is within the 16ms budget', () => {
  const xs = sampleGridComposeDiff();
  const med = median(xs);
  if (perfBudgetMode(process.env) === 'log') {
    console.log(`perf (informational): 60x22 grid compose+diff median ${med.toFixed(3)}ms p95 ${p95(xs).toFixed(3)}ms`);
    return;
  }
  // Reference the sink so the optimizer must keep the measured work.
  if (sink < 0) console.log('');
  expect(med <= BUDGET_MS, `median ${med.toFixed(3)}ms exceeds the ${BUDGET_MS}ms budget`).toBeTruthy();
});
