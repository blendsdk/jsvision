/**
 * End-to-end test for the input-dropdowns demo (RD-14 AC-11/AC-12 → the demo walkthrough).
 *
 * Immutable oracle: the `demo:dropdowns` walkthrough runs standalone — no real host/TTY — exits 0 and
 * prints a non-empty ASCII walkthrough containing the `▐↓▌` dropdown icon, the History pick filling
 * the field (the focused index-1 entry), the editable ComboBox filtering to a single match + setting
 * value, the select-only ComboBox type-ahead landing on Magenta, and the Esc-cancel leaving the field
 * unchanged. Mirrors the containers-demo e2e child-process spawn; heavier than the unit specs, so it
 * lives outside the unit glob. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'dropdowns-demo', 'main.ts');

test('demo:dropdowns runs standalone, exits 0, and prints the dropdowns walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:dropdowns did not exit in time'));
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
  // The shared dropdown button icon (History + ComboBox reuse the same glyphs, PA-11).
  expect(result.stdout).toContain('▐'); // U+2590 right half block (icon side)
  expect(result.stdout).toContain('↓'); // U+2193 down arrow (narrow, PA-3)
  expect(result.stdout).toContain('▌'); // U+258C left half block (icon side)
  // History: the focused index-1 entry (count > 1) fills the field.
  expect(result.stdout).toContain('History picked: ~/dev');
  // Editable ComboBox: filter-as-you-type → single match → value set.
  expect(result.stdout).toContain('editable filtered to: Rust');
  expect(result.stdout).toContain('editable value: Rust');
  // Select-only ComboBox: open + type-ahead.
  expect(result.stdout).toContain('type-ahead landed on: Magenta');
  expect(result.stdout).toContain('select-only value: Magenta');
  // Esc-cancel: popup closed, field untouched.
  expect(result.stdout).toContain('after Esc, popup open? false');
  expect(result.stdout).toContain('after Esc, field unchanged: keep-me');
});
