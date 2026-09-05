/**
 * Distribution specification for GroupBox agent guidance, generated plugin output, and release
 * notes. These assertions pin the supported consumer surfaces independently from their generators.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

/** Resolve a repository-relative artifact from this test module. */
function artifact(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const CANONICAL_CATALOG = artifact('../../../tools/jsvision-skill/references/component-catalog.md');
const GENERATED_CATALOG = artifact('../../../plugins/jsvision-plugin/skills/jsvision/references/component-catalog.md');
const GENERATED_CONTAINERS = artifact('../../../tools/jsvision-skill/references/api/containers.md');
const GENERATED_CORE = artifact('../../../tools/jsvision-skill/references/api/core-essentials.md');

describe('GroupBox supported distribution', () => {
  test('teaches the complete component selection and layout boundary in the canonical skill', () => {
    // The chooser must distinguish passive visual grouping from structural and interactive containers.
    expect(CANONICAL_CATALOG).toMatch(/\*\*GroupBox\*\*[\s\S]*passive/iu);
    expect(CANONICAL_CATALOG).toMatch(/GroupBox[\s\S]*Group[\s\S]*TabView[\s\S]*Window[\s\S]*Dialog/iu);
    // Consumer guidance must carry the public defaults and external shadow-spacing responsibility.
    expect(CANONICAL_CATALOG).toMatch(/title[\s\S]*empty[\s\S]*titleAlignment[\s\S]*start/iu);
    expect(CANONICAL_CATALOG).toMatch(/padding[\s\S]*1[\s\S]*staticText/iu);
    expect(CANONICAL_CATALOG).toMatch(/shadow[\s\S]*two columns[\s\S]*one row/iu);
  });

  test('keeps the assembled plugin copy and generated API category synchronized', () => {
    expect(GENERATED_CATALOG).toBe(CANONICAL_CATALOG);
    expect(GENERATED_CONTAINERS).toContain('## GroupBox');
    expect(GENERATED_CONTAINERS).toContain('interface GroupBoxOptions');
    expect(GENERATED_CONTAINERS).toContain("type GroupBoxTitleAlignment = 'start' | 'center' | 'end'");
    expect(GENERATED_CORE).not.toContain('## GroupBox');
  });

  test.each([
    ['ui', '../../ui/CHANGELOG.md'],
    ['examples', '../CHANGELOG.md'],
    ['docs-site', '../../docs-site/CHANGELOG.md'],
  ] as const)('records one %s release note under Unreleased', (_packageName, relativePath) => {
    const changelog = artifact(relativePath);
    const unreleasedAt = changelog.indexOf('## [Unreleased]');
    const firstReleaseAt = changelog.search(/^## \[\d/mu);

    expect(unreleasedAt).toBeGreaterThan(-1);
    expect(unreleasedAt).toBeLessThan(firstReleaseAt);
    expect(changelog.slice(unreleasedAt, firstReleaseAt).match(/GroupBox/gu)).toHaveLength(1);
  });
});
