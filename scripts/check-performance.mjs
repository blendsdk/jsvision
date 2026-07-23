#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PERFORMANCE_TESTS = [
  ['workspace', '@jsvision/core', 'test', 'test/perf-budget.spec.test.ts', '--maxWorkers=1'],
  ['workspace', '@jsvision/ui', 'test', 'test/editor-perf.spec.test.ts', '--maxWorkers=1'],
  ['workspace', '@jsvision/datagrid', 'test', 'test/perf-grid-bench.spec.test.ts', '--maxWorkers=1'],
];

/**
 * Run each wall-clock budget in its own single-worker process.
 *
 * The marker makes a locally invoked serial check authoritative even if a parent
 * Turbo task leaked its hash. CI and the explicit local skip retain precedence
 * in the budget helper and therefore remain informational.
 *
 * @returns {number} Zero when every performance specification passes.
 * @example
 * process.exitCode = runPerformanceChecks();
 */
export function runPerformanceChecks() {
  const useShell = process.platform === 'win32';
  const env = { ...process.env, JSVISION_PERF_CHECK: '1' };

  for (const args of PERFORMANCE_TESTS) {
    const result = spawnSync('yarn', args, { env, stdio: 'inherit', shell: useShell });
    if (result.error) {
      process.stderr.write(`perf:check could not start ${args[1]}: ${result.error.message}\n`);
      return 1;
    }
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runPerformanceChecks();
}
