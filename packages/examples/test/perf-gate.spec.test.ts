import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { STEPS } from '../../../scripts/gate.mjs';

const monorepoRoot = resolve(import.meta.dirname, '../../..');

test('the serial performance command uses the cross-platform authoritative runner', () => {
  const packageJson = JSON.parse(readFileSync(resolve(monorepoRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, unknown>;
  };

  expect(packageJson.scripts?.['perf:check']).toBe('node scripts/check-performance.mjs');

  const runner = readFileSync(resolve(monorepoRoot, 'scripts/check-performance.mjs'), 'utf8');
  expect(runner).toContain("JSVISION_PERF_CHECK: '1'");
  expect(runner).toContain("const useShell = process.platform === 'win32'");
  expect(runner).toContain('shell: useShell');
  expect(runner.match(/--maxWorkers=1/g)).toHaveLength(5);
  expect(runner).toContain('@jsvision/core');
  expect(runner).toContain('@jsvision/ui');
  expect(runner).toContain('@jsvision/datagrid');
  expect(runner).toContain(
    "['workspace', '@jsvision/kanban', 'test', 'test/perf-kanban-bench.spec.test.ts', '--maxWorkers=1']",
  );
  expect(runner).toContain('@jsvision/code-editor');
  expect(runner).toContain('test/code-editor-architecture.spec.test.ts');
  expect(runner).toContain('src/quality.perf.test.ts');
  expect(runner).toContain('src/languages/languages.perf.test.ts');
  expect(runner).toContain('src/ui/folding.perf.test.ts');
  expect(runner).toContain('src/ui/viewport-long-line.perf.test.ts');

  const codeEditorPolicy = readFileSync(
    resolve(monorepoRoot, 'packages/code-editor/test/performance-policy.ts'),
    'utf8',
  );
  expect(codeEditorPolicy).toContain("perfBudgetMode(process.env) === 'assert'");
});

test('CI skips the serial wall-clock performance command before starting benchmark processes', () => {
  const result = spawnSync(process.execPath, [resolve(monorepoRoot, 'scripts/check-performance.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
    timeout: 10_000,
  });

  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('perf:check skipped');
});

test('the acceptance gate runs the serial performance check after parallel verification', () => {
  const verifyIndex = STEPS.findIndex(({ id }) => id === 'verify');
  const perfIndex = STEPS.findIndex(({ id }) => id === 'perf');

  expect(perfIndex).toBeGreaterThan(verifyIndex);
  expect(STEPS[perfIndex]).toMatchObject({
    cmd: 'yarn',
    args: ['perf:check'],
  });
});
