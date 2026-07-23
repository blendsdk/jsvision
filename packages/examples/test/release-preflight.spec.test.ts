// Release preparation must be identical in the publishing workflow and the required pre-merge
// simulation, so a version-dependent generated artifact cannot fail only after master changes.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const monorepoRoot = resolve(import.meta.dirname, '../../..');

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(monorepoRoot, path), 'utf8');
}

describe('release preflight', () => {
  test('defines one release preparation command with plugin regeneration before validation', () => {
    const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
      scripts?: Record<string, unknown>;
    };
    const command = packageJson.scripts?.['release:prepare'];

    expect(command).toBe(
      'yarn lockstep:version --no-git-commit && node scripts/sync-package-versions.mjs && yarn plugin:version && yarn plugin:update && yarn plugin:check',
    );
  });

  test('uses the shared preparation command in the publishing workflow', () => {
    const workflow = readRepositoryFile('.github/workflows/release.yml');

    expect(workflow).toContain('run: yarn release:prepare');
    expect(workflow).not.toContain('run: yarn lockstep:version --no-git-commit');
  });

  test('automatically releases only merged pull requests targeting master', () => {
    const workflow = readRepositoryFile('.github/workflows/release.yml');

    expect(workflow).toContain('pull_request_target:');
    expect(workflow).toContain('branches: [master]');
    expect(workflow).toContain('types: [closed]');
    expect(workflow).toContain('if: github.event.pull_request.merged == true');
    expect(workflow).toContain('RELEASE_DIST_TAG: latest');
    expect(workflow).not.toContain('workflow_dispatch:');
    expect(workflow).not.toContain('DRY_RUN');
  });

  test('simulates release preparation only for pull requests targeting master', () => {
    const workflow = readRepositoryFile('.github/workflows/ci.yml');

    expect(workflow).toContain('release-preflight:');
    expect(workflow).toContain("github.event_name == 'pull_request' && github.base_ref == 'master'");
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('run: yarn release:prepare');
    expect(workflow).not.toContain('lockstep publish');
    expect(workflow).not.toContain('git push');
  });
});
