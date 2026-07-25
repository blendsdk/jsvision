import { expect, test } from 'vitest';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const demoRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(demoRoot, '../../..');
const tsx = join(repositoryRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const OUTPUT_LIMIT = 64_000;

/** Runs the standalone walkthrough as an external consumer process. */
function runShowcase(): Promise<{ readonly code: number | null; readonly stdout: string; readonly stderr: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(tsx, [join(demoRoot, 'main.ts')], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const stop = (): void => {
      clearTimeout(timeout);
      child.stdout.removeAllListeners();
      child.stderr.removeAllListeners();
      child.removeAllListeners();
    };
    const rejectOnce = (error: Error): void => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      stop();
      rejectRun(error);
    };
    const timeout = setTimeout(() => {
      rejectOnce(new Error('demo:code-editor did not exit within 15 seconds'));
    }, 15_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout, 'utf8') > OUTPUT_LIMIT)
        rejectOnce(new Error('demo stdout exceeded its byte limit'));
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr, 'utf8') > OUTPUT_LIMIT)
        rejectOnce(new Error('demo stderr exceeded its byte limit'));
    });
    child.on('error', rejectOnce);
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      stop();
      resolveRun({ code, stdout, stderr });
    });
  });
}

test('standalone Code Editor walkthrough narrates representative states and exits cleanly', async () => {
  const result = await runShowcase();
  expect(result.code, result.stderr).toBe(0);
  expect(result.stdout).toContain('Frame 1 — edit and local language state');
  expect(result.stdout).toContain('simulated intelligence');
  expect(result.stdout).toContain('completion=1 diagnostics=1');
  expect(result.stdout).toContain('degradation and recovery');
  expect(result.stdout).toContain('host authorization');
  expect(result.stdout).toMatch(/effects=.*navigate/u);
  expect(result.stdout).toContain('terminalSafe=true');
  expect(result.stdout).toContain('large/reduced confirmation=true');
  expect(result.stdout).toContain('terminal resized');
  expect(result.stdout).toContain('exited cleanly with no external services');
  expect(result.stdout).not.toContain('\u001B[');
});
