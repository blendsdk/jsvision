/**
 * End-to-end test for the containers/scrolling/lists demo (RD-11 AC-15 → ST-16).
 *
 * Immutable oracle: the `demo:containers` walkthrough runs standalone — no real host/TTY — exits 0
 * and prints a non-empty ASCII walkthrough containing the ScrollBar glyphs (`▲`/`█`/`▼` — the thumb is
 * the user-approved `█` block deviation, `scroll-bar.ts:36`, not the ambiguous-width `■`), the
 * Scroller revealing lower lines, the ListView type-ahead landing on Grape + the selection, and the
 * modal Dialog frame (`╔`/`[×]`) with the `valid()`-gate narration (vetoed → resolved: ok). Mirrors
 * the controls-demo e2e child-process spawn; heavier than the unit specs, so it lives outside the
 * unit glob. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'containers-demo', 'main.ts');

test('demo:containers runs standalone, exits 0, and prints the containers walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:containers did not exit in time'));
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
  // ScrollBar chrome.
  expect(result.stdout).toContain('▲'); // up arrow
  expect(result.stdout).toContain('█'); // thumb — the user-approved █ block deviation (scroll-bar.ts:36, not ■)
  expect(result.stdout).toContain('▼'); // down arrow
  expect(result.stdout).toContain('ScrollBar value: 13'); // 3×arrow + 1×page(10)
  // Scroller revealed lower content.
  expect(result.stdout).toContain('Line 09'); // scrolled past the first page
  // ListView type-ahead + select.
  expect(result.stdout).toContain('type-ahead landed on: Grape');
  expect(result.stdout).toContain('Enter selected index: 3 = Grape');
  // Dialog frame + valid()-gate narration.
  expect(result.stdout).toContain('╔'); // gray-dialog double border
  expect(result.stdout).toContain('[×]'); // the close box (no zoom box)
  expect(result.stdout).toContain('vetoed by valid()'); // OK rejected on the invalid Age
  expect(result.stdout).toContain('resolved: ok'); // OK resolved once corrected
});
