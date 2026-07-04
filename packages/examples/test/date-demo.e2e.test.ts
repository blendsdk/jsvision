/**
 * End-to-end test for the date-family demo (RD-20 AC-16 → ST-16).
 *
 * Immutable oracle: the `demo:date` walkthrough runs standalone — no real host/TTY — exits 0 and prints
 * a non-empty ASCII walkthrough: the `Calendar` header (September → October 2026), the ▲/▼ month
 * arrows, the day/month-nav + commit narration, the committed value line, and the `DatePicker` Alt+↓
 * popup-open + commit. Mirrors `feedback-demo.e2e`; heavier than the unit specs, so it lives outside
 * the unit glob. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'date-demo', 'main.ts');

test('demo:date runs standalone, exits 0, and prints the date-family walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:date did not exit in time'));
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
  // Calendar geometry + month nav.
  expect(result.stdout).toContain('September 2026');
  expect(result.stdout).toContain('October 2026'); // PgDn advanced the month
  expect(result.stdout).toContain('Su Mo Tu We Th Fr Sa');
  expect(result.stdout).toContain('▲'); // next-month arrow
  expect(result.stdout).toContain('▼'); // prev-month arrow / picker button
  // Walkthrough narration.
  expect(result.stdout).toContain('day-nav');
  expect(result.stdout).toContain('month nav to October');
  expect(result.stdout).toContain('Enter commits');
  // The Calendar committed October 4 (cursor Sep 4 → PgDn → Oct 4 → Enter).
  expect(result.stdout).toContain('Calendar value = 2026-10-04');
  // DatePicker popup open + commit.
  expect(result.stdout).toContain('Alt+↓ opens the anchored Calendar popup');
  expect(result.stdout).toContain('DatePicker value = 2026-09-03'); // today committed via the popup
  expect(result.stdout).toContain('Done —');
});
