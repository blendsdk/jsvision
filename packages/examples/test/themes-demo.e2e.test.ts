/**
 * End-to-end test for the theme designer (RD-22 AC-15 → ST-34).
 *
 * Immutable oracle: the `demo:themes` walkthrough runs standalone (no real host/TTY), exits 0, and
 * prints a non-empty walkthrough that shows a theme switch, a depth change, and a JSON export.
 * Mirrors `feedback-demo.e2e`; heavier than the unit specs, so it lives outside the unit glob. `.js`
 * per NodeNext.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'themes-demo', 'main.ts');

test('demo:themes runs standalone, exits 0, and prints the designer walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:themes did not exit in time'));
    }, 15_000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.on('error', (err) => {
      clearTimeout(guard);
      rejectPromise(err);
    });
    child.on('close', (code) => {
      clearTimeout(guard);
      resolvePromise({ code, stdout });
    });
    child.stdin.end();
  });

  expect(result.code).toBe(0); // standalone exit, no real host
  expect(result.stdout.length).toBeGreaterThan(0);
  // A theme switch (accent cycle).
  expect(result.stdout).toContain('Theme switch');
  // A depth change.
  expect(result.stdout).toContain('Depth change');
  // A JSON export (the versioned envelope).
  expect(result.stdout).toContain('Exported theme JSON');
  expect(result.stdout).toContain('"version": 1');
  expect(result.stdout).toContain('Done.');
});
