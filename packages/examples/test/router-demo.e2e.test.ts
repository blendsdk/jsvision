/**
 * End-to-end test for the navigation-router demo (Phase 3 → ST-17, the drill-down half).
 *
 * Immutable oracle: the `demo:router` walkthrough runs standalone — no real host/TTY — exits 0 and
 * prints a non-empty ASCII walkthrough proving the drill-down flow: the list screen, a scroll (arrow
 * down), a `push` into a `detail` screen with its own swapped status bar, and an `Esc`/`back` to the
 * kept-warm list whose scroll row is preserved (keepAlive). Mirrors the controls-demo / event-demo
 * e2e child-process spawn; heavier than the unit specs, so it lives outside the unit glob.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
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
