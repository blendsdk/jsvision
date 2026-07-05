/**
 * End-to-end test for the files-family demo (RD-09, `@jsvision/files` → ST-17).
 *
 * Immutable oracle: the `demo:files` walkthrough runs standalone — no real host/TTY — exits 0 and
 * prints the file-dialog family over an in-memory `FileSystem`: the open `FileDialog` (2-col listing +
 * `▐↓▌` History + info pane), the `*.ts` re-filter, the descend into `src/`, the resolved file path,
 * and the `ChDirDialog` `DirList` tree (incl. the last-row graphics fixup). Mirrors `surface-demo.e2e`;
 * heavier than the unit specs, so it lives outside the unit glob. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // packages/examples/test/
const pkgRoot = resolve(here, '..'); // the examples package root
const monorepoRoot = resolve(here, '../../..'); // tsx is hoisted to the monorepo root .bin
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'files-demo', 'main.ts');

test('demo:files runs standalone, exits 0, and prints the files-family walkthrough', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:files did not exit in time'));
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

  // Step narration.
  expect(result.stdout).toContain('Step 1');
  expect(result.stdout).toContain('re-filters');
  expect(result.stdout).toContain('descended into /home/user/src');
  expect(result.stdout).toContain('Step 5');

  // The open dialog composition + faithful rendering.
  expect(result.stdout).toContain('Open a File');
  expect(result.stdout).toContain('Change Directory');
  expect(result.stdout).toContain('▐↓▌'); // the History icon
  expect(result.stdout).toContain('readme.txt'); // step-1 listing
  expect(result.stdout).toContain('deep.ts'); // step-3 descended listing

  // The valid() state machine resolved the absolute path.
  expect(result.stdout).toContain('resolved path: /home/user/src/deep.ts');

  // The DirList tree connectors incl. the last-row graphics fixup.
  expect(result.stdout).toContain('└─┬/');
  expect(result.stdout).toContain('└──nested');

  // No reactive leak warning leaks into the walkthrough output.
  expect(result.stdout).not.toContain('created outside any createRoot');
});
