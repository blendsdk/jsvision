/**
 * End-to-end test for the color-family demo (RD-21 AC-12 → ST-13).
 *
 * Immutable oracle: the `demo:color` walkthrough runs standalone — no real host/TTY — exits 0 and
 * prints a non-empty ASCII walkthrough: the `ColorSwatch` grid (`█` cells + the `◘` marker), the
 * arrow-nav + commit narration + committed value, and the `ColorPicker` popup-open + hex-type + commit.
 * Mirrors `date-demo.e2e`; heavier than the unit specs, so it lives outside the unit glob. `.js` per
 * NodeNext.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'color-demo', 'main.ts');

test('demo:color runs standalone, exits 0, and prints the color-family walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:color did not exit in time'));
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
  // ColorSwatch geometry: 3-wide █ cells + the ◘ marker.
  expect(result.stdout).toContain('█');
  expect(result.stdout).toContain('◘');
  // Walkthrough narration.
  expect(result.stdout).toContain('selects the next cell LIVE');
  expect(result.stdout).toContain('hex field');
  expect(result.stdout).toContain('commits');
  // The swatch committed magenta (init blue → → magenta → Enter).
  expect(result.stdout).toContain('ColorSwatch value = magenta');
  // The ▐↓▌ dropdown button + the picker popup + the committed hex.
  expect(result.stdout).toContain('▐↓▌');
  expect(result.stdout).toContain('#12ab34');
  expect(result.stdout).toContain('ColorPicker value = #12ab34');
  expect(result.stdout).toContain('Done —');
});
