/**
 * End-to-end test for the app-shell demo (RD-05; AC-22 integration e2e flavor).
 *
 * Immutable oracle (AR-70): the `demo:shell` walkthrough runs standalone — no real host/TTY — exits
 * 0 and prints non-empty themed ASCII frames across the window-manager + menu + status sequence
 * (open windows → raise → drag → zoom → tile → menu command → status accelerator). Mirrors the
 * event-demo / probe e2e child-process spawn; heavier than the unit specs, so it lives outside the
 * unit glob.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'shell-demo', 'main.ts');

test('demo:shell runs standalone, exits 0, and prints a window-manager + menu + status walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:shell did not exit in time'));
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
  expect(result.stdout).toContain('Window'); // the menu-bar title composed
  expect(result.stdout).toContain('Editor'); // a window title in the frame chrome
  expect(result.stdout).toContain('Tile'); // a status-line item
  expect(result.stdout).toContain('click raises'); // the raise step narration
  expect(result.stdout).toContain('drag "Editor"'); // the drag step narration
  expect(result.stdout).toContain('Window ▸ Cascade'); // the menu-command step narration
  expect(result.stdout).toContain('status accelerator F4'); // the status step narration
});
