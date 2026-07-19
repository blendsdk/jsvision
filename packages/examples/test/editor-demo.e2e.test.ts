/**
 * End-to-end test for the editor demo (RD-08 AC-18).
 *
 * Immutable oracle: the `demo:editor` walkthrough runs standalone — no real host/TTY — exits 0
 * and prints the narrated ASCII walkthrough: the indicator `═`/`1:1` strip, the double-click word
 * selection, cut/paste through the clipboard editor, undo/redo, the find + replace-all count, and
 * the final "Done" line. Mirrors `feedback-demo.e2e`. `.js` per NodeNext.
 */
import { test, expect, describe, beforeAll } from 'vitest';
import { spawn } from 'node:child_process';
import { spawnDemo, frameRows } from './spawn-demo.js';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const monorepoRoot = resolve(here, '../../..');
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'editor-demo', 'main.ts');

test('demo:editor runs standalone, exits 0, and prints the editor walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:editor did not exit in time'));
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

  expect(result.code).toBe(0);
  expect(result.stdout).toContain('══'); // the Indicator strip fill
  expect(result.stdout).toContain('1:1'); // the initial line:col
  expect(result.stdout).toContain('Double-click selects the word: "quick"');
  expect(result.stdout).toContain('clipboard: "quick"'); // held selected in the clipboard editor
  expect(result.stdout).toContain('Undo ×2');
  expect(result.stdout).toContain('replacement(s), the PF-009 count');
  expect(result.stdout).toContain('Done — WordStar keymap');
});

/**
 * Composition snapshot for the editor over its indicator strip.
 *
 * The demo prints its whole composed buffer after every step, so the running demo is the geometry
 * oracle and no view tree is rebuilt here.
 */
describe('demo:editor composed frame', () => {
  let stdout = '';

  beforeAll(async () => {
    const run = await spawnDemo('editor-demo', 30_000);
    expect(run.code).toBe(0);
    stdout = run.stdout;
  });

  test('the editor fills above a full-width indicator strip on the last row', () => {
    const rows = frameRows(stdout, '1. Loaded — the Indicator shows 1:1');

    expect(rows).toHaveLength(8);
    expect(rows[0]).toBe('The quick brown fox jumps.                  '); // the editor from the very first row
    expect(rows[1]).toBe('Second line.                                ');
    // Were the strip laid out beside the editor instead of under it, it would be one cell wide and
    // `1:1` would never reach the bottom row.
    expect(rows[7]).toBe('══════ 1:1 ═════════════════════════════════');
  });
});
