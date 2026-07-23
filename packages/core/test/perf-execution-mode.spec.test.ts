import { expect, test } from 'vitest';
import { perfBudgetMode } from '../bench/frame-bench.mjs';

test('performance budgets assert only in a deliberate non-Turbo local run', () => {
  expect(perfBudgetMode({})).toBe('assert');
  expect(perfBudgetMode({ CI: 'true' })).toBe('log');
  expect(perfBudgetMode({ TUI_SKIP_PERF: '1' })).toBe('log');
  expect(perfBudgetMode({ TURBO_HASH: 'task-hash' })).toBe('log');
});

test('the serial performance marker overrides Turbo but never CI or an explicit skip', () => {
  expect(perfBudgetMode({ JSVISION_PERF_CHECK: '1', TURBO_HASH: 'task-hash' })).toBe('assert');
  expect(perfBudgetMode({ JSVISION_PERF_CHECK: '1', CI: 'true' })).toBe('log');
  expect(perfBudgetMode({ JSVISION_PERF_CHECK: '1', TUI_SKIP_PERF: '1' })).toBe('log');
});
