// Specification oracle for the check-plugin.mjs integrity rules (ST-13…ST-16, ST-18).
//
// The focused checks assert each integrity rule trips on a seeded-broken input. The real plugin tree
// is validated once by the uncached `plugin:check` step at the end of the repository-wide verify
// command, where TypeScript API extraction is not constrained by a per-test timeout.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import {
  checkArchetypesValid,
  checkBarrelCoverage,
  checkDrift,
  checkGotchas,
  checkLinksInDir,
  checkManifestData,
  checkTreesEqual,
  countGotchas,
} from '../../../scripts/check-plugin.mjs';
import { checkPluginImpact, readImpactRegistry } from '../../../scripts/plugin-impact.mjs';

const CANONICAL_SKILL = fileURLToPath(new URL('../../../tools/jsvision-skill/', import.meta.url));
const DISTRIBUTED_SKILL = fileURLToPath(new URL('../../../plugins/jsvision-plugin/skills/jsvision/', import.meta.url));

// ST-13 — a reference file linking to a missing target fails, naming the file + dead target.
test('ST-13: a dead link is reported with the file and the missing target', () => {
  const dir = fileURLToPath(new URL('./fixtures/plugin-deadlink', import.meta.url));
  const errors = checkLinksInDir(dir);
  expect(errors.length).toBeGreaterThan(0);
  const joined = errors.join('\n');
  expect(joined).toContain('bad.md');
  expect(joined).toContain('nope.md');
});

// ST-14 — a manifest missing a required field, or a marketplace not referencing the plugin, fails.
test('ST-14: manifest schema failures are reported', () => {
  const goodManifest = { name: 'jsvision-plugin' };
  const goodMarket = {
    name: 'm',
    plugins: [
      {
        name: 'jsvision-plugin',
        source: { source: 'local', path: './plugins/jsvision-plugin' },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        category: 'Developer Tools',
      },
    ],
  };

  // plugin.json missing its required `name`.
  expect(checkManifestData({}, goodMarket, 'jsvision-plugin', true).length).toBeGreaterThan(0);
  // marketplace.json does not reference the plugin.
  const emptyMarket = { name: 'm', plugins: [] };
  expect(checkManifestData(goodManifest, emptyMarket, 'jsvision-plugin', true).length).toBeGreaterThan(0);
  // both good → no errors.
  expect(checkManifestData(goodManifest, goodMarket, 'jsvision-plugin', true)).toEqual([]);
});

// ST-15 — a recipe .md whose embedded block differs from its source region fails (snippet drift).
test('ST-15: snippet drift between an embedded block and its source region is reported', () => {
  const md = '# Recipe\n\n```ts\nconst answer = 1;\n```\n';
  expect(checkDrift(md, 'const answer = 2;').length).toBeGreaterThan(0); // differs
  expect(checkDrift(md, 'const answer = 1;')).toEqual([]); // matches
});

// ST-16 — removing a footgun from gotchas.md trips the completeness check.
test('ST-16: gotchas completeness requires all 16 footguns', () => {
  const fifteen = Array.from({ length: 15 }, (_, i) => `### ${i + 1}. footgun\n\ntext\n`).join('\n');
  expect(checkGotchas(fifteen, 16).length).toBeGreaterThan(0);
  const sixteen = Array.from({ length: 16 }, (_, i) => `### ${i + 1}. footgun\n\ntext\n`).join('\n');
  expect(checkGotchas(sixteen, 16)).toEqual([]);
  expect(countGotchas(sixteen)).toBe(16);
});

// ST-18 — barrel-coverage: an undocumented class export, or a catalog naming a removed class, fails.
test('ST-18: barrel-coverage catches undocumented and removed widget classes', () => {
  // A class export missing from the catalog (forward gap).
  const catalog = '- **Button** — a button.\n';
  expect(checkBarrelCoverage(['Button', 'GhostWidget'], catalog, []).length).toBeGreaterThan(0);
  // The catalog names a class that is no longer exported (reverse gap).
  const staleCatalog = '- **Button** — a button.\n- **RemovedThing** — gone.\n';
  expect(checkBarrelCoverage(['Button'], staleCatalog, []).length).toBeGreaterThan(0);
  // A denylisted base class need not be documented and is not required.
  expect(checkBarrelCoverage(['Button', 'View'], catalog, ['View'])).toEqual([]);
});

// ST-19 — archetype validation: a well-formed archetype passes; a missing main.ts.tmpl / about.txt,
// a buildApp-less starter, or malformed package.json.tmpl each trips.
test('ST-19: archetype validation catches malformed archetype directories', () => {
  const root = fileURLToPath(new URL('./fixtures/plugin-archetypes-tmp/', import.meta.url));
  rmSync(root, { recursive: true, force: true });
  const write = (rel: string, body: string) => {
    const abs = join(root, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, body);
  };
  try {
    // A well-formed archetype: exports buildApp + carries about.txt → no errors.
    write('good/main.ts.tmpl', 'export function buildApp() { return null; }\n');
    write('good/about.txt', 'A good archetype.\n');
    expect(checkArchetypesValid(root)).toEqual([]);

    // A starter with no buildApp export (breaks the shared smoke-test contract).
    write('nobuild/main.ts.tmpl', 'export const x = 1;\n');
    write('nobuild/about.txt', 'desc\n');
    expect(checkArchetypesValid(root).some((e) => e.includes('nobuild'))).toBe(true);

    // An archetype missing about.txt.
    write('nodesc/main.ts.tmpl', 'export function buildApp() {}\n');
    expect(checkArchetypesValid(root).some((e) => e.includes('nodesc') && e.includes('about.txt'))).toBe(true);

    // An archetype that overrides package.json.tmpl with invalid JSON.
    write('badpkg/main.ts.tmpl', 'export function buildApp() {}\n');
    write('badpkg/about.txt', 'desc\n');
    write('badpkg/package.json.tmpl', '{ not json');
    expect(checkArchetypesValid(root).some((e) => e.includes('badpkg') && e.includes('JSON'))).toBe(true);

    // A missing archetypes dir is fine (only `basic` is available).
    expect(checkArchetypesValid(join(root, 'does-not-exist'))).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ST-28 — every canonical reference routed from Data Grid source changes must be reviewed and the
// distributed plugin must remain a byte-for-byte assembly of that canonical content.
test('ST-28: Data Grid source impact and distributed plugin references are synchronized', () => {
  const registry = readImpactRegistry();
  const areas = registry.areas.filter((area) => area.paths.includes('packages/datagrid/src'));
  expect(areas.map((area) => area.name)).toEqual(expect.arrayContaining(['datagrid', 'internationalization']));

  const areaNames = new Set(areas.map((area) => area.name));
  expect(checkPluginImpact().filter((finding) => areaNames.has(finding.name))).toEqual([]);

  const datagridReference = readFileSync(join(CANONICAL_SKILL, 'references/datagrid.md'), 'utf8');
  expect(datagridReference).toContain('An open cell editor consumes Escape');
  expect(datagridReference).toContain('atomic `onRevertRow` callback');
  expect(datagridReference).toContain('row changes cannot be reverted');
  expect(datagridReference).toContain('Keep row keys and row object identity stable during a session');
  expect(datagridReference).toContain('cannot reattach retry state');
  expect(datagridReference).toContain('Never echo callback exceptions or row values in status text');

  const i18nReference = readFileSync(join(CANONICAL_SKILL, 'references/i18n.md'), 'utf8');
  expect(i18nReference).toContain('Pass that same service');
  expect(i18nReference).toContain('`EditableDataGrid`');
  expect(i18nReference).toContain('pending-revert, failed-revert, and unavailable-revert feedback');

  const references = new Set(areas.flatMap((area) => area.references));
  for (const reference of references) {
    expect(readFileSync(join(DISTRIBUTED_SKILL, reference), 'utf8')).toBe(
      readFileSync(join(CANONICAL_SKILL, reference), 'utf8'),
    );
  }
  expect(checkTreesEqual(CANONICAL_SKILL, DISTRIBUTED_SKILL)).toEqual([]);
});
