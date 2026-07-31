// Commit authorship belongs to the human author; repository tooling must reject every additional
// co-author trailer locally and in CI, independent of the attributed identity or capitalization.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { findCoAuthorAttribution } from '../../../scripts/check-commit-attribution.mjs';

const monorepoRoot = resolve(import.meta.dirname, '../../..');

describe('commit attribution policy', () => {
  test.each([
    'Co-Authored-By: Claude <noreply@example.com>',
    'co-authored-by: Codex <noreply@example.com>',
    '  CO-AUTHORED-BY : Another Person <person@example.com>',
  ])('rejects an additional author expressed as %s', (trailer) => {
    expect(findCoAuthorAttribution(`feat: add capability\n\n${trailer}\n`)).toEqual({
      lineNumber: 3,
      line: trailer.trim(),
    });
  });

  test('allows ordinary commit messages and unrelated trailers', () => {
    expect(findCoAuthorAttribution('fix: correct focus\n\nSigned-off-by: Developer <dev@example.com>')).toBeUndefined();
  });

  test('enforces the shared checker in local hooks and every verification gate', () => {
    const packageJson = JSON.parse(readFileSync(resolve(monorepoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, unknown>;
    };
    const hook = readFileSync(resolve(monorepoRoot, '.husky/commit-msg'), 'utf8');
    const pushHook = readFileSync(resolve(monorepoRoot, '.husky/pre-push'), 'utf8');

    expect(packageJson.scripts?.['check:commit-attribution']).toBe('node scripts/check-commit-attribution.mjs');
    expect(packageJson.scripts?.['verify:local']).toContain('yarn check:commit-attribution');
    expect(packageJson.scripts?.verify).toContain('yarn check:commit-attribution');
    expect(packageJson.scripts?.['verify:shipped']).toContain('yarn check:commit-attribution');
    expect(hook).toContain('check-commit-attribution.mjs --message-file "$1"');
    expect(pushHook).toContain('check-commit-attribution.mjs --pushed-refs');
  });
});
