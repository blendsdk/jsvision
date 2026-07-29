/**
 * Specification coverage for the Codex plugin integration course.
 *
 * Installation and skill discovery happen in the Codex host, outside the documentation terminal.
 * The course therefore teaches the supported tagged-marketplace workflow and proves it with the
 * repository's real manifests, canonical skill tree, assembled distribution, and integrity gate.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { runAllChecks } from '../../../scripts/check-plugin.mjs';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DOCS_ROOT = join(REPOSITORY_ROOT, 'packages', 'docs-site');
const GUIDE = readFileSync(join(DOCS_ROOT, 'guide', 'codex-plugin.md'), 'utf8');
const CATALOG = parseGuideCatalog(readFileSync(join(DOCS_ROOT, 'guides.json'), 'utf8'));
const ROOT_MANIFEST = readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8');
const CORE_MANIFEST = readJsonRecord(join(REPOSITORY_ROOT, 'packages', 'core', 'package.json'));
const PLUGIN_MANIFEST = readJsonRecord(
  join(REPOSITORY_ROOT, 'plugins', 'jsvision-plugin', '.codex-plugin', 'plugin.json'),
);
const MARKETPLACE = readJsonRecord(join(REPOSITORY_ROOT, '.agents', 'plugins', 'marketplace.json'));
const CANONICAL_SKILL = join(REPOSITORY_ROOT, 'tools', 'jsvision-skill');
const DISTRIBUTED_SKILL = join(REPOSITORY_ROOT, 'plugins', 'jsvision-plugin', 'skills', 'jsvision');
const PLUGIN_SKILLS = join(REPOSITORY_ROOT, 'plugins', 'jsvision-plugin', 'skills');

/** Return true when an unknown JSON value is a plain string-keyed object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse one checked-in JSON object without trusting an unchecked type assertion. */
function readJsonRecord(path: string): Readonly<Record<string, unknown>> {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isRecord(value)) throw new TypeError(`${path} must contain a JSON object`);
  return value;
}

/** Read a required string field from a checked-in manifest. */
function requiredString(record: Readonly<Record<string, unknown>>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value === '') throw new TypeError(`${field} must be a non-empty string`);
  return value;
}

/** Return the checked-in skill directory names in deterministic order. */
function pluginSkillNames(): readonly string[] {
  return readdirSync(PLUGIN_SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe('Codex plugin course contract', () => {
  test('should preserve the integration profile, prerequisite, and authentic zero-lab exception', () => {
    const entry = CATALOG.entries.find((candidate) => candidate.id === 'codex-plugin');

    expect(entry).toMatchObject({
      title: 'Codex plugin',
      profile: 'integration',
      prerequisites: ['install-and-packages'],
      requiredLiveExamples: 0,
      examples: [],
    });
    expect(['upgrade', 'complete']).toContain(entry?.stage);
    expect(entry?.learningOutcomes).toEqual([
      'Install and invoke the supported JSVision Codex plugin workflow.',
      'Distinguish generated plugin guidance from canonical repository sources.',
    ]);
    expect(entry?.liveExampleException).toMatch(
      /Codex installation[\s\S]*host integration[\s\S]*outside[\s\S]*browser documentation runtime/iu,
    );
    expect(GUIDE).toContain('](/guide/install-and-packages)');
    expect(GUIDE).not.toContain('<PlayExample');
  });

  test('should teach the tagged marketplace installation recorded by the release tooling', () => {
    const stableVersion = requiredString(CORE_MANIFEST, 'version');
    const pluginVersion = requiredString(PLUGIN_MANIFEST, 'version');
    const marketplacePlugins = MARKETPLACE.plugins;
    if (!Array.isArray(marketplacePlugins)) throw new TypeError('marketplace plugins must be an array');
    const marketplaceEntry = marketplacePlugins.find(
      (candidate) => isRecord(candidate) && candidate.name === 'jsvision-plugin',
    );

    expect(pluginVersion).toBe(stableVersion);
    expect(MARKETPLACE.name).toBe('jsvision-marketplace');
    expect(marketplaceEntry).toBeDefined();
    expect(GUIDE).toContain(`codex plugin marketplace add blendsdk/jsvision --ref v${stableVersion}`);
    expect(GUIDE).toContain('codex plugin add jsvision-plugin@jsvision-marketplace');
    expect(GUIDE).toMatch(/start a new Codex thread[\s\S]*skills are discovered/iu);
    expect(GUIDE).toMatch(/plugin version[\s\S]*(?:lockstep|same|match)[\s\S]*@jsvision/iu);
  });

  test('should teach explicit invocation and the four skills actually shipped by the plugin', () => {
    expect(pluginSkillNames()).toEqual(['jsvision', 'jsvision-doctor', 'jsvision-new-app', 'jsvision-render']);
    expect(GUIDE).toContain('Use $jsvision to build a keyboard-first inventory application.');
    for (const skill of ['$jsvision', '$jsvision-new-app', '$jsvision-doctor', '$jsvision-render']) {
      expect(GUIDE).toContain(`\`${skill}\``);
    }
    expect(GUIDE).toMatch(/\$jsvision-new-app[\s\S]*(?:basic|form)[\s\S]*grid[\s\S]*dashboard/iu);
    expect(GUIDE).toMatch(/\$jsvision-doctor[\s\S]*(?:diagnos|mistake|footgun)/iu);
    expect(GUIDE).toMatch(/doctor[\s\S]*consumer project's TypeScript/iu);
    expect(GUIDE).toMatch(/\$jsvision-render[\s\S]*(?:headless|text screenshot)[\s\S]*(?:80x24|size|keys)/iu);
  });

  test('should distinguish canonical guidance from the generated distribution and name the real gates', () => {
    expect(existsSync(join(CANONICAL_SKILL, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(DISTRIBUTED_SKILL, 'SKILL.md'))).toBe(true);
    expect(ROOT_MANIFEST).toMatch(/"plugin:update"\s*:\s*"node scripts\/update-plugin\.mjs"/u);
    expect(ROOT_MANIFEST).toMatch(/"plugin:check"\s*:\s*"node scripts\/check-plugin\.mjs"/u);

    expect(GUIDE).toContain('`tools/jsvision-skill/`');
    expect(GUIDE).toContain('`plugins/jsvision-plugin/skills/jsvision/`');
    expect(GUIDE).toMatch(/tools\/jsvision-skill\/[\s\S]*(?:canonical|edit|source of truth)/iu);
    expect(GUIDE).toMatch(
      /plugins\/jsvision-plugin\/skills\/jsvision\/[\s\S]*(?:generated|assembled|do not edit|never edit)/iu,
    );
    expect(GUIDE).toContain('yarn plugin:update');
    expect(GUIDE).toContain('yarn plugin:check');
  });

  test('should replace an embedded lab with verified host-side manifest and distribution evidence', () => {
    const integrity = runAllChecks();

    expect(integrity).toEqual({ ok: true, errors: [] });
    expect(GUIDE).toMatch(/## (?:Verify|Evidence|How the integration is verified)/iu);
    expect(GUIDE).toMatch(/(?:outside|instead of|without)[\s\S]*(?:embedded|browser|live)[\s\S]*(?:lab|example)/iu);
    expect(GUIDE).toContain('check-plugin: PASS — all integrity checks green');
    expect(GUIDE).toMatch(/plugin\.json[\s\S]*marketplace\.json[\s\S]*(?:distribution|skill tree)/iu);
    expect(GUIDE).toMatch(/canonical[\s\S]*(?:generated|distributed)[\s\S]*(?:equal|match|drift)/iu);
  });

  test('should document the real generator, doctor, and renderer command boundaries', () => {
    expect(GUIDE).toContain('node <skill-directory>/new-jsvision-app.mjs <name> --package-manager <manager>');
    expect(GUIDE).toContain('node <skill-directory>/jsvision-doctor.mjs [path]');
    expect(GUIDE).toContain('<package-manager> exec tsx <skill-directory>/render-app.mjs <module>');
    expect(GUIDE).toMatch(/--template\s+form\|grid\|dashboard/u);
    expect(GUIDE).toContain('--current-dir');
    expect(GUIDE).toMatch(/explicit confirmation[\s\S]*current directory/iu);
    expect(GUIDE).toMatch(/renderer[\s\S]*(?:buildApp|build)[\s\S]*default factory/iu);
    expect(GUIDE).toMatch(/consumer project[\s\S]*TypeScript[\s\S]*(?:ask|approval)[\s\S]*(?:install|dependency)/iu);
  });

  test('should diagnose installation, discovery, version, doctor, and renderer failures with evidence', () => {
    expect(GUIDE).toMatch(/## (?:Troubleshooting|Failure modes|Diagnos(?:e|ing))/iu);
    expect(GUIDE).toMatch(/symptom[\s\S]*cause[\s\S]*(?:correction|fix)[\s\S]*(?:evidence|verify)/iu);

    const expectedEvidence = [
      /Plugin not listed[\s\S]*codex plugin marketplace list/iu,
      /Skill changes are not visible[\s\S]*(?:reinstall|plugin add)[\s\S]*new Codex thread/iu,
      /version[\s\S]*(?:differ|mismatch)[\s\S]*(?:package|plugin)/iu,
      /Doctor cannot find TypeScript[\s\S]*(?:development dependency|dev dependency)/iu,
      /Renderer cannot resolve JSVision[\s\S]*@jsvision\/ui/iu,
      /Renderer cannot find an entry[\s\S]*(?:buildApp|build)[\s\S]*default/iu,
    ];
    for (const evidence of expectedEvidence) expect(GUIDE).toMatch(evidence);
  });

  test('should teach the supported update flow and route the reader to productive next courses', () => {
    expect(GUIDE).toContain('codex plugin marketplace upgrade jsvision-marketplace');
    expect(GUIDE).toContain('codex plugin add jsvision-plugin@jsvision-marketplace');
    expect(GUIDE).toMatch(/## (?:Practice|Next steps|Practice and next steps)/iu);
    expect(GUIDE).toContain('](/guide/layout)');
    expect(GUIDE).toContain('](/guide/testing-headlessly)');
  });
});
