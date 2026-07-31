import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, test } from 'vitest';
import { parseHistoryRecords, parsePushedRevisions } from '../../../scripts/check-commit-attribution.mjs';

const monorepoRoot = resolve(import.meta.dirname, '../../..');
const checker = resolve(monorepoRoot, 'scripts/check-commit-attribution.mjs');
const temporaryDirectories = new Set<string>();

afterEach(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
  temporaryDirectories.clear();
});

describe('commit attribution checker implementation', () => {
  test('parses complete NUL-delimited history records', () => {
    expect(parseHistoryRecords('abc\0feat: one\0def\0fix: two\n\0')).toEqual([
      { sha: 'abc', message: 'feat: one' },
      { sha: 'def', message: 'fix: two\n' },
    ]);
  });

  test('rejects truncated history output', () => {
    expect(() => parseHistoryRecords('abc\0complete message\0def')).toThrow(
      'Git returned an incomplete commit-message record.',
    );
  });

  test('extracts unique pushed revisions and ignores branch deletions', () => {
    const first = '1'.repeat(40);
    const second = '2'.repeat(40);
    const zero = '0'.repeat(40);
    const input = [
      `refs/heads/one ${first} refs/heads/one ${zero}`,
      `refs/heads/two ${second} refs/heads/two ${first}`,
      `refs/tags/copy ${first} refs/tags/copy ${zero}`,
      `refs/heads/delete ${zero} refs/heads/delete ${second}`,
      '',
    ].join('\n');

    expect(parsePushedRevisions(input)).toEqual([first, second]);
  });

  test('rejects invalid pushed commit IDs before invoking Git', () => {
    expect(() =>
      parsePushedRevisions('refs/heads/main --all refs/heads/main 0000000000000000000000000000000000000000'),
    ).toThrow('Git supplied an invalid local commit ID.');
  });

  test('rejects a prohibited message file with a useful diagnostic', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jsvision-attribution-'));
    temporaryDirectories.add(directory);
    const messageFile = join(directory, 'COMMIT_EDITMSG');
    writeFileSync(messageFile, 'feat: example\r\n\r\nCo-authored-by: Tool <tool@example.com>\r\n');

    const result = spawnSync(process.execPath, [checker, '--message-file', messageFile], {
      cwd: monorepoRoot,
      encoding: 'utf8',
      shell: false,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('line 3');
    expect(result.stderr).toContain('Remove all co-author attribution trailers');
  });

  test('accepts a normal message file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jsvision-attribution-'));
    temporaryDirectories.add(directory);
    const messageFile = join(directory, 'COMMIT_EDITMSG');
    writeFileSync(messageFile, 'chore: maintain repository\n');

    const result = spawnSync(process.execPath, [checker, '--message-file', messageFile], {
      cwd: monorepoRoot,
      encoding: 'utf8',
      shell: false,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });
});
