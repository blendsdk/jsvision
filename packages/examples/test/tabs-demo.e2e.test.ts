/**
 * End-to-end test for the tabs demo (RD-17 AC-13 → ST-36).
 *
 * Immutable oracle: the `demo:tabs` walkthrough runs standalone — no real host/TTY — exits 0 and
 * prints a non-empty ASCII walkthrough containing the faithful folder-tab chrome glyphs
 * (`┌`/`┬`/`│`/`└`/`×`/`◄`/`►`) and the render → Ctrl+PageDown → Alt-jump → close → overflow step
 * narration + the final "Done" line. Mirrors `tree-demo.e2e`/`table-demo.e2e`; heavier than the unit
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
const mainPath = join(pkgRoot, 'tabs-demo', 'main.ts');

test('demo:tabs runs standalone, exits 0, and prints the tabs walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:tabs did not exit in time'));
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
  // Faithful folder-tab chrome glyphs (GATE-1 decode).
  expect(result.stdout).toContain('┌'); // top-left corner
  expect(result.stdout).toContain('┬'); // between-tabs notch
  expect(result.stdout).toContain('│'); // side border
  expect(result.stdout).toContain('└'); // bottom-left corner
  expect(result.stdout).toContain('×'); // closeable-tab mark
  expect(result.stdout).toContain('◄'); // overflow-left arrow
  expect(result.stdout).toContain('►'); // overflow-right arrow
  // Walkthrough narration: render → Ctrl+PageDown → Alt-jump → close → overflow.
  expect(result.stdout).toContain('Frame 1 — render');
  expect(result.stdout).toContain('Ctrl+PageDown → Display');
  expect(result.stdout).toContain('Alt+N → Network');
  expect(result.stdout).toContain('closed Display');
  expect(result.stdout).toContain('overflow');
  expect(result.stdout).toContain('Done — a TabView rendered');
});
