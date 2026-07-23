/**
 * End-to-end test for the event-loop demo (RD-04, PA-9; AC-20 e2e flavor).
 *
 * Immutable oracle (AR-59): the `demo:events` walkthrough runs standalone — no real host/TTY —
 * exits 0 and prints a non-empty themed ASCII frame across the focus → command → modal sequence,
 * resolving the awaited `execView` promise. Mirrors the view-demo / probe e2e child-process spawn;
 * heavier than the unit specs, so it lives outside the unit glob.
 */
import { test, expect, describe, beforeAll } from 'vitest';
import { spawn } from 'node:child_process';
import { spawnDemo, frameRows } from './spawn-demo.js';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'event-demo', 'main.ts');

test('demo:events runs standalone, exits 0, and prints a focus + command + modal walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:events did not exit in time'));
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
  expect(result.stdout).toContain('jsvision — Event Loop (RD-04)'); // the menu-bar title composed
  expect(result.stdout).toContain('OK'); // a focusable button
  expect(result.stdout).toContain("'ok' command handled"); // the command step narration
  expect(result.stdout).toContain('modal open'); // the execView step
  expect(result.stdout).toContain('Dialog resolved with: ok'); // the awaited promise resolved
});

/**
 * Composition snapshots for the demo's desktop tree.
 *
 * The demo prints its whole composed buffer after every step, so the running demo itself is the
 * geometry oracle — no view tree is rebuilt here. Each case asserts complete row strings rather than
 * relationships between solved values: a relationship such as "the second button starts after the
 * first" also holds when both collapse to zero width, whereas a row string pins the exact column of
 * every character on the line.
 */
describe('demo:events composed frames', () => {
  let stdout = '';

  beforeAll(async () => {
    const run = await spawnDemo('event-demo', 30_000);
    expect(run.code, run.stderr).toBe(0);
    stdout = run.stdout;
    // Above vitest's 10s default hook budget, and above the child guard so its message wins.
  }, 40_000);

  test('the desktop is inset by one blank cell on every side, and each band sits on its own row', () => {
    const rows = frameRows(stdout, 'Frame 1 — focus on [OK]');

    expect(rows).toHaveLength(12);
    expect(rows[0]).toBe('                                                  '); // the top inset
    expect(rows[1]).toBe('  jsvision — Event Loop (RD-04)                   '); // header, 1 row
    expect(rows[3]).toBe('  Dialog — press Enter to close                   '); // dialog, row 1 of 2
    expect(rows[4]).toBe('    Close                                         '); // dialog, row 2 of 2
    expect(rows[5]).toBe('  Last command: (none)                            '); // status, 1 row
    expect(rows[11]).toBe('                                                  '); // the bottom inset
  });

  test('the button row separates the two buttons by exactly the two-cell gap', () => {
    const rows = frameRows(stdout, 'Frame 1 — focus on [OK]');

    // Both buttons share the row equally, minus the gap: a lost gap widens each by one cell and
    // shifts every character of the second button one column to the left.
    expect(rows[2]).toBe('  > OK                       Open Dialog          ');
  });

  test('the dialog stacks its label above its button', () => {
    const rows = frameRows(stdout, 'Frame 4 — execView(dialog): modal open, input captured');

    // Were the dialog to flow horizontally, both children would be one cell wide and neither line
    // would survive.
    expect(rows[3]).toBe('  Dialog — press Enter to close                   ');
    expect(rows[4]).toBe('  > Close                                         ');
  });
});
