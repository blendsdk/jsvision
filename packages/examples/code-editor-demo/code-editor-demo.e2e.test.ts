import { expect, test } from 'vitest';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const demoRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(demoRoot, '../../..');
const tsx = join(repositoryRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

/** Runs the standalone walkthrough as an external consumer process. */
function runShowcase(): Promise<{ readonly code: number | null; readonly stdout: string; readonly stderr: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(tsx, [join(demoRoot, 'main.ts')], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rejectRun(new Error('demo:code-editor did not exit within 15 seconds'));
    }, 15_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.stderr.on('data', (chunk: string) => (stderr += chunk));
    child.on('error', rejectRun);
    child.on('close', (code) => {
      clearTimeout(timeout);
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
