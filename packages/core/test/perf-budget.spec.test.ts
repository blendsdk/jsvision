/**
 * Performance and detection budget specifications.
 *
 * The 200×50 compose-and-diff median must stay within one 16 ms frame, and a
 * non-responding terminal query must fall back near its configured timeout.
 * Wall-clock bounds are enforced only by deliberate serial runs; CI, Turbo
 * fan-out, and explicit local skips record measurements without gating.
 */
import { test, expect } from 'vitest';
import { resolveCapabilitiesAsync } from '../src/engine/index.js';
import type { TerminalQuery } from '../src/engine/index.js';
import { measureComposeDiff, perfBudgetMode } from '../bench/frame-bench.mjs';

/** The 200×50 compose-and-diff frame budget. */
const BUDGET_MS = 16;
/** Median is taken over this many warmed iterations, never a single sample. */
const ITER = 200;

test('ST-1: 200x50 compose+diff median is within the 16ms frame budget', () => {
  const median = measureComposeDiff(200, 50, ITER);
  if (perfBudgetMode(process.env) === 'log') {
    console.log(`perf (informational): 200x50 compose+diff median ${median.toFixed(3)}ms`);
    return;
  }
  expect(median <= BUDGET_MS).toBeTruthy();
});

// The stub blocks forever on its first read. A generator that simply ended would
// return immediately and never prove that the timeout wins the race.
test('ST-3: detection against a non-responding query falls back within the budget', async () => {
  const neverResponds: TerminalQuery = {
    write() {
      /* discarded */
    },
    read: () => ({
      [Symbol.asyncIterator]: () => ({
        next: () =>
          new Promise<IteratorResult<Uint8Array>>(() => {
            /* never resolves — forces the timeoutMs branch to win the race */
          }),
      }),
    }),
  };

  const timeoutMs = 80;
  const t0 = performance.now();
  const { profile } = await resolveCapabilitiesAsync({ query: neverResponds, timeoutMs, env: {}, platform: 'linux' });
  const elapsed = performance.now() - t0;

  // Always: it completed via fallback rather than hanging.
  expect(profile).toBeTruthy();

  // A lower bound proves it waited; the upper bound proves the timeout is bounded.
  if (perfBudgetMode(process.env) === 'assert') {
    expect(elapsed >= timeoutMs * 0.5).toBeTruthy();
    expect(elapsed <= timeoutMs + 60).toBeTruthy();
  }
});
