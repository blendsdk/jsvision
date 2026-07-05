/**
 * End-to-end test for the surface-family demo (RD-19 AC-12 → ST-12).
 *
 * Immutable oracle: the `demo:surface` walkthrough runs standalone — no real host/TTY — exits 0 and
 * prints a non-empty ASCII walkthrough: the 6×4 `SurfaceView` over the 12×8 `Surface`, the pan-right +
 * pan-down frames (surface letters visible), the **pan-past-the-edge** empty-area frame (the whole view
 * blank — the `windowInactive` fill), and the recentre. Mirrors `color-demo.e2e`; heavier than the unit
 * specs, so it lives outside the unit glob. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'surface-demo', 'main.ts');

test('demo:surface runs standalone, exits 0, and prints the surface-family walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:surface did not exit in time'));
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

  // Step narration.
  expect(result.stdout).toContain('Step 1');
  expect(result.stdout).toContain('pan right');
  expect(result.stdout).toContain('pan down');
  expect(result.stdout).toContain('past the edge');
  expect(result.stdout).toContain('empty area');
  expect(result.stdout).toContain('recentre');

  // Step 1 top-left frame content (first two surface rows).
  expect(result.stdout).toContain('ABCDEF');
  expect(result.stdout).toContain('MNOPQR');
  // Step 2 pan-right frame content (middle columns).
  expect(result.stdout).toContain('DEFGHI');

  // Step 4 — the empty-area frame: an all-blank 6-wide row (the windowInactive fill) appears.
  expect(result.stdout).toContain(`|${' '.repeat(6)}|`);

  expect(result.stdout).toContain('Done —');
});
