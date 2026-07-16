// Specification oracle for the check-plugin.mjs integrity gate (ST-12…ST-16, ST-18).
//
// The gate guards the whole plugin: manifest schema, link-graph, recipe snippet-drift, gotchas
// completeness, and @jsvision/ui barrel-coverage. ST-12 asserts the real plugin passes every check;
// the rest assert each check trips on a seeded-broken input. Immutable oracle: if the gate disagrees,
// the gate is wrong — never the test.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
  countGotchas,
  runAllChecks,
} from '../../../scripts/check-plugin.mjs';

// ST-12 — the real plugin tree passes every check.
test('ST-12: runAllChecks passes on the real plugin tree', () => {
  const { ok, errors } = runAllChecks();
  expect(errors).toEqual([]);
  expect(ok).toBe(true);
});

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
  const goodMarket = { name: 'm', owner: { name: 'x' }, plugins: [{ name: 'jsvision-plugin', source: './p' }] };

  // plugin.json missing its required `name`.
  expect(checkManifestData({}, goodMarket, 'jsvision-plugin', true).length).toBeGreaterThan(0);
  // marketplace.json does not reference the plugin.
  const emptyMarket = { name: 'm', owner: { name: 'x' }, plugins: [] };
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
test('ST-16: gotchas completeness requires all 12 footguns', () => {
  const eleven = Array.from({ length: 11 }, (_, i) => `### ${i + 1}. footgun\n\ntext\n`).join('\n');
  expect(checkGotchas(eleven, 12).length).toBeGreaterThan(0);
  const twelve = Array.from({ length: 12 }, (_, i) => `### ${i + 1}. footgun\n\ntext\n`).join('\n');
  expect(checkGotchas(twelve, 12)).toEqual([]);
  expect(countGotchas(twelve)).toBe(12);
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
