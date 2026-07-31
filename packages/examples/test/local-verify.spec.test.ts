// Local verification must stay changed-files-only; CI remains responsible for the full gate.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const monorepoRoot = resolve(import.meta.dirname, '../../..');

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(monorepoRoot, path), 'utf8');
}

describe('local verification', () => {
  test('runs the changed-files verifier without replacing the complete CI command', () => {
    const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
      scripts?: Record<string, unknown>;
    };

    expect(packageJson.scripts?.['verify:local']).toBe(
      'yarn check:commit-attribution && node scripts/verify-local.mjs',
    );
    expect(packageJson.scripts?.verify).toContain('turbo run test');
  });

  test('uses NUL-delimited filenames and never invokes a shell', () => {
    const verifier = readRepositoryFile('scripts/verify-local.mjs');

    expect(verifier).toContain('shell: false');
    expect(verifier).toContain("'--ignore-unknown'");
    expect(verifier).toContain("'ls-files', '--others', '--exclude-standard', '-z'");
  });
});
