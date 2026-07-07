/**
 * End-to-end smoke for the tvedit clone (RD-08 AR-260 — the acceptance oracle's launch half).
 *
 * Immutable oracle: launched WITHOUT a TTY, `demo:tvedit` composes the full clone headlessly,
 * prints ONE first frame, and exits 0. The frame carries the decoded chrome: the tvedit menu bar
 * (`File Edit Search Windows`), the `░` desktop, the active Untitled `EditWindow` with its gadget
 * chrome (`▲`/`▼` bar + the `══` indicator strip), the INACTIVE `Clipboard` window as a plain
 * frame (the PA-10 hide-when-inactive rule), and the decoded status row (`F2 Save … Alt-X Exit`).
 * Full interactivity is the manual oracle (run it in a real terminal). `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const monorepoRoot = resolve(here, '../../..');
const tsxBin = join(monorepoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(pkgRoot, 'tvedit-demo', 'main.ts');

test('demo:tvedit launches headlessly, exits 0, and prints the decoded first frame', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('demo:tvedit did not exit in time'));
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
  expect(result.stdout).toContain('File  Edit  Search  Windows'); // the decoded menu bar
  expect(result.stdout).toContain('░'); // the desktop field
  expect(result.stdout).toContain('Untitled'); // the active EditWindow title
  expect(result.stdout).toContain('══'); // its indicator strip (gadgets visible while active)
  expect(result.stdout).toContain('Clipboard'); // the clipboard window (inactive → plain frame)
  expect(result.stdout).toContain('F2 Save'); // the decoded status row
  expect(result.stdout).toContain('Alt-X Exit');
});
