/**
 * End-to-end test for the essential-controls demo (RD-06 AC-12 → ST-14).
 *
 * Immutable oracle (PA-13): the `demo:controls` walkthrough runs standalone — no real host/TTY —
 * exits 0 and prints a non-empty ASCII walkthrough containing the Label/Button text, the `[X]` and
 * `(•)` markers, the Input field glyphs, and a narration proving the `filter` live-reject + the `'ok'`
 * emit. Mirrors the event-demo / view-demo e2e child-process spawn; heavier than the unit specs, so it
 * lives outside the unit glob.
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
const mainPath = join(pkgRoot, 'controls-demo', 'main.ts');

test('demo:controls runs standalone, exits 0, and prints the controls walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:controls did not exit in time'));
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
  expect(result.stdout).toContain('Name'); // the Label text
  expect(result.stdout).toContain('OK'); // the Button text
  expect(result.stdout).toContain('[X]'); // a checked CheckGroup item
  expect(result.stdout).toContain('(•)'); // a selected RadioGroup item
  expect(result.stdout).toContain('▄'); // the Button block-glyph shadow
  expect(result.stdout).toContain("rejected '3'"); // filter live-reject narration
  expect(result.stdout).toContain('"Alx"'); // the value after the live reject
  expect(result.stdout).toContain('["ok"]'); // the 'ok' command reached the spy via ev.emit
});

/**
 * Composition snapshot for the demo's form.
 *
 * The demo prints its whole composed buffer, so the running demo is the geometry oracle and no view
 * tree is rebuilt here. Complete row strings are asserted rather than relationships between solved
 * values, which stay true even when the values collapse to zero.
 */
describe('demo:controls composed frame', () => {
  let stdout = '';

  beforeAll(async () => {
    const run = await spawnDemo('controls-demo', 30_000);
    expect(run.code).toBe(0);
    stdout = run.stdout;
  });

  test('the form is inset by one blank cell and stacks every control with no row between', () => {
    const rows = frameRows(stdout, 'Frame 1 — form composed; Input focused (caret shows)');

    expect(rows).toHaveLength(18);
    expect(rows[0]).toBe('                              '); // the top inset
    expect(rows[1]).toBe(' Name                         '); // label, then its input on row 2
    expect(rows[3]).toBe(' Phone                        '); // directly under the input — nothing between
    expect(rows[5]).toBe('  [ ] Bold                    '); // the check group, both rows
    expect(rows[6]).toBe('  [ ] Italic                  ');
    expect(rows[7]).toBe('  (•) Left                    '); // the radio group starts immediately after
    expect(rows[14]).toBe(' command: (none)              '); // the spy, last in the stack
  });
});
