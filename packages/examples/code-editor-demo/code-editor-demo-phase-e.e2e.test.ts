import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const demoRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(demoRoot, '../../..');
const tsx = join(repositoryRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const OUTPUT_LIMIT = 64_000;

/** Runs the bounded non-TTY journey without granting it an interactive input stream. */
function runHeadlessJourney(): Promise<{
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(tsx, [join(demoRoot, 'main.ts')], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
      rejectOnce(new Error('Code Editor evidence journey exceeded its 15-second resource bound.'));
    }, 15_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout, 'utf8') > OUTPUT_LIMIT) {
        rejectOnce(new Error('Code Editor evidence stdout exceeded its byte limit.'));
      }
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr, 'utf8') > OUTPUT_LIMIT) {
        rejectOnce(new Error('Code Editor evidence stderr exceeded its byte limit.'));
      }
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

test('standalone evidence journey is bounded, keyboard-operable, safe, and self-contained', async () => {
  // The process journey must prove live protocol handling, host decisions, editor isolation,
  // keyboard operation, and capability execution without relying on any external service.
  const result = await runHeadlessJourney();

  expect(result.code, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('live requests=completion,diagnostics,navigation,formatting,cancellation');
  expect(result.stdout).toContain('host decisions=accepted,rejected,version-conflict');
  expect(result.stdout).toContain('multi-editor isolation=true');
  expect(result.stdout).toMatch(/capability journeys=\d+\/\d+ complete/u);
  expect(result.stdout).toContain('keyboard journey=true');
  expect(result.stdout).toContain('no external services');
  expect(result.stdout.length).toBeLessThan(64_000);
  expect(result.stdout).not.toMatch(/[\u001B\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u);
});
