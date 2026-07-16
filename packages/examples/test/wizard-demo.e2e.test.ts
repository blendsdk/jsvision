/**
 * End-to-end test for the navigation-router **wizard** demo (the primary reference app).
 *
 * Immutable oracle: the `demo:wizard` walkthrough runs standalone — no real host/TTY — exits 0 and
 * prints a non-empty ASCII walkthrough proving the multi-step wizard flow: a shared `@jsvision/forms`
 * form spanning three router screens, a `Next` action that is **greyed until the current step
 * validates** (an invalid `emitCommand('wizard.next')` is dropped, so navigation does not advance), a
 * final review→`submit()` that echoes the coerced values, and `keepAlive` preserving a step's entered
 * value across a Back round-trip. Mirrors the drill-down `router-demo` e2e child-process spawn;
 * heavier than the unit specs, so it lives outside the unit glob.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'wizard-demo', 'main.ts');

test('demo:wizard runs standalone, exits 0, and prints the multi-step wizard walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:wizard did not exit in time'));
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
  expect(result.stdout).toContain('Step 1 of 3: Account'); // the first wizard step
  expect(result.stdout).toContain('Next enabled: false'); // the gate is closed on the empty first step
  expect(result.stdout).toContain('dropped: true'); // emitting Next while invalid is dropped (no advance)
  expect(result.stdout).toContain('Next enabled: true'); // filling the step opens the gate
  expect(result.stdout).toContain('Step 2 of 3: Preferences'); // Next advanced to the second step
  expect(result.stdout).toContain('Step 3 of 3: Review'); // and on to the review step
  expect(result.stdout).toContain('"name":"review"'); // push updated location()
  expect(result.stdout).toContain('Submitted:'); // the review step submitted the shared form
  expect(result.stdout).toContain('"email":"ada@example.com"'); // the coerced values were echoed
  expect(result.stdout).toContain('PASS'); // keepAlive preserved the first step's value across Back
});
