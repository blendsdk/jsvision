/**
 * End-to-end test for the feedback demo (RD-18 AC-13 → ST-13).
 *
 * Immutable oracle: the `demo:feedback` walkthrough runs standalone — no real host/TTY — exits 0 and
 * prints a non-empty ASCII walkthrough containing the smooth-fill glyphs (`█`/`░`), the pure-ASCII
 * fallback forms (`#`/`-`), the bar 0→33→66→100% + spinner-frame step narration, and the final "Done"
 * line. Mirrors `tabs-demo.e2e`; heavier than the unit specs, so it lives outside the unit glob. `.js`
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
const mainPath = join(pkgRoot, 'feedback-demo', 'main.ts');

test('demo:feedback runs standalone, exits 0, and prints the feedback walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:feedback did not exit in time'));
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
  // Smooth-fill glyphs (Unicode caps).
  expect(result.stdout).toContain('█'); // full block (100% fill)
  expect(result.stdout).toContain('░'); // track shade
  // Pure-ASCII fallback forms.
  expect(result.stdout).toContain('#'); // ascii bar fill
  expect(result.stdout).toContain('-'); // ascii bar track (also the ruler, but the fallback line is asserted below)
  // Walkthrough narration: bar 0→33→66→100%, spinner steps, ASCII fallback.
  expect(result.stdout).toContain('ProgressBar 0%');
  expect(result.stdout).toContain('ProgressBar 33%');
  expect(result.stdout).toContain('ProgressBar 66%');
  expect(result.stdout).toContain('ProgressBar 100%');
  expect(result.stdout).toContain('Spinner (dots) frame');
  expect(result.stdout).toContain('ASCII fallback: ProgressBar 50%');
  expect(result.stdout).toContain('Spinner dots → line preset');
  expect(result.stdout).toContain('Done — a ProgressBar filled');
});
