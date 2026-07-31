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
  // Clean verification must build every workspace before cross-package contract tests import dist.
  test('orders workspace preparation before tests in the authoritative verification command', () => {
    const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
      scripts?: Record<string, unknown>;
    };
    const command = packageJson.scripts?.verify;

    expect(command).toBe(
      'yarn lint && yarn check:i18n-literals && yarn i18n:locales:check && turbo run typecheck build check:docs && turbo run test && yarn perf:check && yarn plugin:check',
    );
  });

  test('defines one release preparation command with plugin regeneration before validation', () => {
    const packageJson = JSON.parse(readRepositoryFile('package.json')) as {
      scripts?: Record<string, unknown>;
    };
    const command = packageJson.scripts?.['release:prepare'];

    expect(command).toBe(
      'yarn lockstep:version --no-git-commit && node scripts/sync-package-versions.mjs && yarn plugin:version && yarn plugin:update && yarn plugin:check',
    );

    const versionSync = readRepositoryFile('scripts/sync-package-versions.mjs');
    expect(versionSync).toContain("documentationFile: 'packages/docs-site/guide/install-and-packages.md'");
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

  // A public announcement must describe an artifact that npm and GitHub users can already fetch.
  test('publishes generated GitHub release notes only after npm and the version tag succeed', () => {
    const workflow = readRepositoryFile('.github/workflows/release.yml');
    const publishIndex = workflow.indexOf('lockstep publish');
    const pushTagIndex = workflow.indexOf('name: Push the version tag');
    const createReleaseIndex = workflow.indexOf('gh release create');

    expect(publishIndex).toBeGreaterThan(-1);
    expect(pushTagIndex).toBeGreaterThan(publishIndex);
    expect(createReleaseIndex).toBeGreaterThan(pushTagIndex);
    expect(workflow).toContain('--generate-notes');
    expect(workflow).toContain('--notes-start-tag "${PREVIOUS_TAG}"');
    expect(workflow).toContain('--verify-tag');
    expect(workflow).toContain('GH_TOKEN: ${{ github.token }}');
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
