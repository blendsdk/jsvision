/**
 * End-to-end spec (immutable oracle) — the headless walkthrough (ST-23).
 *
 * Piped (no TTY), `src/main.ts` runs the narrated walkthrough instead of the live app: it drives the
 * pure model through initial → alias edit → role override → preset load → depth change → contrast →
 * export, composing and printing a non-empty ASCII frame for each visual step, and exits 0. This is
 * the deterministic integration oracle; it spawns the entrypoint via `tsx`, exactly as `yarn start`
 * would. `.js` is not used here (the child is the .ts entrypoint run through tsx).
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/theme-designer/test/
const pkgRoot = resolve(here, '..'); // the theme-designer package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'src', 'main.ts');

test('the piped walkthrough renders a non-empty frame per step, then exits 0', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('the walkthrough did not exit in time'));
    }, 20_000);
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

  expect(result.code, 'the walkthrough exits cleanly').toBe(0);
  expect(result.stdout.length).toBeGreaterThan(0);

  // A composed frame per visual step (each printed under its heading, bordered with +---+).
  for (const heading of [
    'Initial theme',
    'After alias edit',
    'After role override',
    'After preset load',
    'After depth change',
  ]) {
    expect(result.stdout, `step "${heading}" rendered`).toContain(heading);
  }
  // Each frame is non-empty: at least one bordered grid was printed.
  expect(result.stdout, 'a bordered frame was drawn').toMatch(/\+-{5,}\+/);

  // The non-visual steps: a contrast readout and a JSON export (the versioned envelope).
  expect(result.stdout).toContain('Contrast');
  expect(result.stdout).toContain('Exported theme JSON');
  expect(result.stdout).toContain('"version": 1');
  expect(result.stdout).toContain('Done.');
});
