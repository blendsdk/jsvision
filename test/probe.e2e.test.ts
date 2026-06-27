/**
 * End-to-end tests for the capability-probe harness (RD-03, plan doc 03-04).
 *
 * Immutable oracles: ST-24 (RD AC-5) — `--auto` exits 0 and emits schema-valid
 * JSON with manual items unverified; ST-23 (RD AC-7) — a real SIGINT during the
 * interactive run restores the terminal (leave alt-screen + show cursor).
 *
 * No `node-pty` (mirrors RD-07's host-signals.e2e): the interactive child
 * advertises its piped streams as TTYs with a no-op setRawMode, exercising the
 * real host signal/restore path. Heavier than the unit specs — outside the unit
 * glob; run explicitly: `npx tsx --test test/probe.e2e.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // test/
const repoRoot = resolve(here, '..');
const tsxBin = join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const mainPath = join(repoRoot, 'examples', 'capability-probe', 'main.ts');
const mainUrl = pathToFileURL(mainPath).href;

// ST-24: --auto exits 0 with schema-valid JSON; manual items are unverified (null).
test('ST-24: --auto emits schema-valid JSON and exits 0', async () => {
  const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(tsxBin, [mainPath, '--auto', '--no-matrix'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('--auto did not exit in time'));
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

  assert.equal(result.code, 0, '--auto exits 0');
  const report: unknown = JSON.parse(result.stdout);
  assert.ok(report !== null && typeof report === 'object', 'stdout is a JSON object');
  const r = report as Record<string, unknown>;
  for (const key of ['terminal', 'os', 'term', 'colorterm', 'results', 'recommendation']) {
    assert.ok(key in r, `report has ${key}`);
  }
  const results = r.results as Record<string, { supported: unknown; method: unknown }>;
  assert.equal(results['attr.bold'].supported, null, 'a manual item is unverified in --auto');
  assert.equal(results['attr.bold'].method, 'manual');
});

const INTERACTIVE_CHILD = `
import { main } from ${JSON.stringify(mainUrl)};
import { Writable } from 'node:stream';

// Forward to the real stdout fd but advertise a TTY (no pty available).
const realOut = process.stdout;
const output = new Writable({ write(chunk, _enc, cb) { realOut.write(chunk); cb(); } });
output.isTTY = true; output.columns = 80; output.rows = 24; output.fd = 1;

// Real stdin, advertised as a TTY with a no-op setRawMode (it is piped here).
const input = process.stdin;
input.isTTY = true;
if (typeof input.setRawMode !== 'function') input.setRawMode = () => input;

void main({
  isTty: () => true,
  input, output,
  stdout: realOut, stderr: process.stderr,
  env: { TERM: 'xterm-256color' },
  platform: process.platform,
  argv: [],
});
`;

// ST-23: a real SIGINT during the interactive run restores the terminal.
test('ST-23: a real SIGINT restores the terminal (leave alt-screen + show cursor)', async () => {
  const work = mkdtempSync(join(tmpdir(), 'rd03-e2e-'));
  const childPath = join(work, 'probe-child.ts');
  writeFileSync(childPath, INTERACTIVE_CHILD);

  try {
    const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
      const child = spawn(tsxBin, [childPath], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let sent = false;
      const guard = setTimeout(() => {
        child.kill('SIGKILL');
        rejectPromise(new Error('interactive child did not exit in time'));
      }, 15_000);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        if (!sent) {
          sent = true; // first output is the enter-mode sequence; now interrupt
          child.kill('SIGINT');
        }
      });
      child.on('error', (err) => {
        clearTimeout(guard);
        rejectPromise(err);
      });
      child.on('close', (code) => {
        clearTimeout(guard);
        resolvePromise({ code, stdout });
      });
    });

    assert.equal(result.code, 130, 'real SIGINT produced exit code 130 (128 + SIGINT)');
    assert.ok(result.stdout.includes('?1049l'), 'left the alternate screen on restore');
    assert.ok(result.stdout.includes('?25h'), 'showed the cursor again on restore');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
