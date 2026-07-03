/**
 * End-to-end test for the DataGrid demo (RD-16 AC-12).
 *
 * Immutable oracle: the `demo:table` walkthrough runs standalone — no real host/TTY — exits 0 and
 * prints a non-empty ASCII walkthrough containing the `│` column dividers, the render → navigate →
 * sort → H-scroll step narration, the ascending sort result (`sort: col 1 asc`, Grace Lee first at
 * age 23), and the final line. Mirrors the tree-demo e2e child-process spawn; heavier than the unit
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
const mainPath = join(pkgRoot, 'table-demo', 'main.ts');

test('demo:table runs standalone, exits 0, and prints the DataGrid walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:table did not exit in time'));
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
  // Faithful TListViewer column divider (tlstview.cpp:130 `\xB3` → U+2502).
  expect(result.stdout).toContain('│');
  // The header titles + a data cell.
  expect(result.stdout).toContain('Name');
  expect(result.stdout).toContain('Age');
  expect(result.stdout).toContain('City');
  // Walkthrough narration: render → navigate → sort → H-scroll.
  expect(result.stdout).toContain('Frame 1 — render');
  expect(result.stdout).toContain('focused: #2 = Carol White');
  expect(result.stdout).toContain('Frame 3 — click Age header');
  expect(result.stdout).toContain('sort: col 1 asc');
  expect(result.stdout).toContain('Grace Lee'); // age 23 → first after ascending sort
  expect(result.stdout).toContain('Frame 4 — →→ horizontal scroll');
  expect(result.stdout).toContain('Done — a DataGrid rendered');
});
