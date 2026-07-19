/**
 * End-to-end test for the navigation-router demo (Phase 3 → ST-17, the drill-down half).
 *
 * Immutable oracle: the `demo:router` walkthrough runs standalone — no real host/TTY — exits 0 and
 * prints a non-empty ASCII walkthrough proving the drill-down flow: the list screen, a scroll (arrow
 * down), a `push` into a `detail` screen with its own swapped status bar, and an `Esc`/`back` to the
 * kept-warm list whose scroll row is preserved (keepAlive). Mirrors the controls-demo / event-demo
 * e2e child-process spawn; heavier than the unit specs, so it lives outside the unit glob.
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
const mainPath = join(pkgRoot, 'router-demo', 'main.ts');

test('demo:router runs standalone, exits 0, and prints the drill-down walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:router did not exit in time'));
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
  expect(result.stdout).toContain('Repositories'); // the list screen title
  expect(result.stdout).toContain('list focused row after ↓↓↓: 3'); // arrowing scrolled the list
  expect(result.stdout).toContain('Repository: repo-04'); // Enter drilled into the focused repo (index 3)
  expect(result.stdout).toContain('"name":"detail","params":{"index":3}'); // push updated location()
  expect(result.stdout).toContain('Esc Back to list'); // the detail screen swapped in its own status bar
  expect(result.stdout).toContain('PASS (3 → 3)'); // keepAlive preserved the list's scroll across back()
});

/**
 * Composition snapshots for the two routed screens.
 *
 * The demo prints its whole composed buffer after every step, so the running demo is the geometry
 * oracle and no screen is rebuilt here. Complete row strings are asserted rather than relationships
 * between solved values, which stay true even when the values collapse to zero.
 */
describe('demo:router composed frames', () => {
  let stdout = '';

  beforeAll(async () => {
    const run = await spawnDemo('router-demo', 30_000);
    expect(run.code, run.stderr).toBe(0);
    stdout = run.stdout;
    // Above vitest's 10s default hook budget, and above the child guard so its message wins.
  }, 40_000);

  test('the list screen is inset by one blank cell, with the list filling below the title', () => {
    const rows = frameRows(stdout, 'Frame 1 — list screen (app base status bar)');

    expect(rows).toHaveLength(16);
    expect(rows[0]).toBe('                                              '); // the top inset
    expect(rows[1]).toBe(' Repositories — ↑↓ to navigate, Enter to open '); // title, first content row
    expect(rows[2]).toBe('  repo-01                                   ▲ '); // the list starts directly under it
    expect(rows[13]).toBe('  repo-12                                   ▼ '); // and fills to the bottom inset
    expect(rows[14]).toBe('                                              '); // the bottom inset
    expect(rows[15]).toBe(' ↑↓/Enter navigate  Alt-X Quit                '); // the app's status line, outside the screen
  });

  test('the detail screen separates its three children by one blank row each', () => {
    const rows = frameRows(stdout, 'Frame 3 — Enter → detail screen (its own status bar)');

    expect(rows).toHaveLength(16);
    expect(rows[0]).toBe('                                              '); // the top inset
    expect(rows[1]).toBe(' Repository: repo-04                          ');
    expect(rows[2]).toBe('                                              '); // the gap
    expect(rows[3]).toBe(' Branch: main · 128 commits · MIT license     ');
    expect(rows[4]).toBe('                                              '); // the gap
    expect(rows[5]).toBe('                     Back                   ▄ '); // the button, 2 rows tall
    expect(rows[6]).toBe('   ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ ');
  });
});
