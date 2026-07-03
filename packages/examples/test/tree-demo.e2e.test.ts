/**
 * End-to-end test for the tree/outline demo (RD-15 AC-12 → ST-24).
 *
 * Immutable oracle: the `demo:tree` walkthrough runs standalone — no real host/TTY — exits 0 and
 * prints a non-empty ASCII walkthrough containing the faithful TV tree-line graph glyphs
 * (`│`/`├`/`└`/`─`/`+`), the expand → navigate → collapse → select step narration, and the final
 * selection (`version.ts`). Mirrors the containers-demo e2e child-process spawn; heavier than the
 * unit specs, so it lives outside the unit glob. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'tree-demo', 'main.ts');

test('demo:tree runs standalone, exits 0, and prints the tree walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:tree did not exit in time'));
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
  // Faithful TV tree-line graph glyphs (toutline.cpp:367 graphChars → unambiguous-narrow Unicode).
  expect(result.stdout).toContain('│'); // level continuation mark
  expect(result.stdout).toContain('├'); // non-last fork
  expect(result.stdout).toContain('└'); // last corner
  expect(result.stdout).toContain('─'); // end filler / expanded marker
  expect(result.stdout).toContain('+'); // collapsed-with-children marker (no brackets)
  // Walkthrough narration: expand → navigate → collapse → select.
  expect(result.stdout).toContain('Frame 1 — collapsed forest');
  expect(result.stdout).toContain('→ expands src');
  expect(result.stdout).toContain('→ expands it (render'); // engine expanded (deep nesting)
  expect(result.stdout).toContain('← collapses engine');
  // The final selection.
  expect(result.stdout).toContain('selected: #3 = version.ts');
  expect(result.stdout).toContain('Done — a Tree expanded');
});
