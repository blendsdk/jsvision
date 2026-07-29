/**
 * Implementation hardening for the Codex plugin integration course.
 *
 * These checks exercise the real canonical/distribution comparator and keep the version transcript
 * synchronized with the stable package and plugin manifests. Synthetic drift proves that each
 * diagnostic remains actionable instead of merely asserting today's green repository.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { checkTreesEqual } from '../../../scripts/check-plugin.mjs';

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GUIDE_PATH = join(REPOSITORY_ROOT, 'packages', 'docs-site', 'guide', 'codex-plugin.md');
const CORE_MANIFEST_PATH = join(REPOSITORY_ROOT, 'packages', 'core', 'package.json');
const PLUGIN_MANIFEST_PATH = join(REPOSITORY_ROOT, 'plugins', 'jsvision-plugin', '.codex-plugin', 'plugin.json');
const CANONICAL_SKILL = join(REPOSITORY_ROOT, 'tools', 'jsvision-skill');
const DISTRIBUTED_SKILL = join(REPOSITORY_ROOT, 'plugins', 'jsvision-plugin', 'skills', 'jsvision');
const temporaryDirectories: string[] = [];

/** Remove every bounded fixture created by the current test. */
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** Read a required string property from a checked-in JSON object. */
function manifestString(path: string, property: string): string {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError(`${path} must contain a JSON object`);
  }
  const value = Reflect.get(parsed, property);
  if (typeof value !== 'string' || value === '') {
    throw new TypeError(`${path}.${property} must be a non-empty string`);
  }
  return value;
}

/** Extract the single stable marketplace tag taught by the install transcript. */
function documentedVersion(markdown: string): string {
  const versions = [...markdown.matchAll(/codex plugin marketplace add blendsdk\/jsvision --ref v([^\s]+)/gu)].map(
    (match) => match[1]!,
  );
  if (versions.length !== 1) {
    throw new TypeError(`expected one tagged installation command, found ${versions.length}`);
  }
  return versions[0];
}

/** Explain every version mismatch relative to the stable package release. */
function versionFindings(stable: string, plugin: string, documented: string): readonly string[] {
  const findings: string[] = [];
  if (plugin !== stable) findings.push(`plugin ${plugin} does not match stable package ${stable}`);
  if (documented !== stable) findings.push(`documented tag ${documented} does not match stable package ${stable}`);
  return findings;
}

/** Create a small canonical/distribution pair for comparator failure tests. */
function driftFixture(): { readonly canonical: string; readonly distributed: string } {
  const root = mkdtempSync(join(REPOSITORY_ROOT, '.codex-guide-drift-'));
  temporaryDirectories.push(root);
  const canonical = join(root, 'canonical');
  const distributed = join(root, 'distributed');
  mkdirSync(join(canonical, 'references'), { recursive: true });
  mkdirSync(join(distributed, 'references'), { recursive: true });
  writeFileSync(join(canonical, 'SKILL.md'), 'canonical\n');
  writeFileSync(join(canonical, 'references', 'layout.md'), 'layout\n');
  writeFileSync(join(distributed, 'SKILL.md'), 'hand edited\n');
  writeFileSync(join(distributed, 'unexpected.md'), 'unexpected\n');
  return { canonical, distributed };
}

describe('Codex plugin course implementation hardening', () => {
  test('should keep the real canonical and assembled skill trees identical', () => {
    expect(checkTreesEqual(CANONICAL_SKILL, DISTRIBUTED_SKILL)).toEqual([]);
  });

  test('should diagnose changed, missing, and unexpected distribution files', () => {
    const fixture = driftFixture();

    expect(checkTreesEqual(fixture.canonical, fixture.distributed)).toEqual([
      'distributed file differs: SKILL.md',
      'missing distributed file: references/layout.md',
      'unexpected distributed file: unexpected.md',
    ]);
  });

  test('should detect stale plugin and documented marketplace versions independently', () => {
    const stable = manifestString(CORE_MANIFEST_PATH, 'version');
    const plugin = manifestString(PLUGIN_MANIFEST_PATH, 'version');
    const documented = documentedVersion(readFileSync(GUIDE_PATH, 'utf8'));

    expect(versionFindings(stable, plugin, documented)).toEqual([]);
    expect(versionFindings(stable, '0.0.0', documented)).toEqual([
      `plugin 0.0.0 does not match stable package ${stable}`,
    ]);
    expect(versionFindings(stable, plugin, '0.0.0')).toEqual([
      `documented tag 0.0.0 does not match stable package ${stable}`,
    ]);
  });
});
