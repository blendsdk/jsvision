/**
 * Parser and completion hardening for the Guide curriculum catalog.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import {
  parseGuideCatalog,
  projectGuideNavigation,
  validateGuideCatalog,
  type GuideCatalog,
  type GuideCatalogEntry,
} from '../src/guides/guide-catalog.mjs';

const CATALOG_SOURCE = readFileSync(fileURLToPath(new URL('../guides.json', import.meta.url)), 'utf8');
const REGISTERED_IDS = EXAMPLES.map((entry) => entry.id);

/** Return a mutable JSON clone for one isolated invalid-catalog exercise. */
function mutableCatalog(): { schemaVersion: 1; entries: GuideCatalogEntry[] } {
  return JSON.parse(CATALOG_SOURCE) as { schemaVersion: 1; entries: GuideCatalogEntry[] };
}

/** Replace one entry while retaining the catalog's stable order. */
function replaceEntry(
  catalog: { schemaVersion: 1; entries: GuideCatalogEntry[] },
  id: string,
  update: Partial<GuideCatalogEntry>,
): void {
  const index = catalog.entries.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`missing Guide fixture entry: ${id}`);
  const current = catalog.entries[index];
  if (current === undefined) throw new Error(`missing Guide fixture index: ${index}`);
  catalog.entries[index] = { ...current, ...update };
}

describe('Guide catalog parser hardening', () => {
  test('should validate the committed complete catalog against concrete registry evidence', () => {
    const catalog = parseGuideCatalog(CATALOG_SOURCE, 'guides.json', {
      registeredExampleIds: REGISTERED_IDS,
    });
    expect(catalog.entries).toHaveLength(31);
    expect(catalog.entries.every((entry) => entry.stage === 'complete')).toBe(true);
  });

  test('should report a deterministic path when prerequisites form a cycle', () => {
    const catalog = mutableCatalog();
    replaceEntry(catalog, 'introduction', { prerequisites: ['layout'] });
    replaceEntry(catalog, 'layout', { prerequisites: ['introduction'] });
    expect(() => validateGuideCatalog(catalog)).toThrow(
      /introduction\.prerequisites: cycle detected: introduction -> layout -> introduction/u,
    );
  });

  test('should reject duplicate routes even when IDs and sidebar positions differ', () => {
    const catalog = mutableCatalog();
    const introduction = catalog.entries.find((entry) => entry.id === 'introduction');
    if (introduction === undefined) throw new Error('missing Introduction fixture');
    replaceEntry(catalog, 'install-and-packages', { page: introduction.page });
    expect(() => validateGuideCatalog(catalog)).toThrow(/catalog\.entries\.page.*duplicate/iu);
  });

  test('should reject a Complete course whose prerequisite is not Complete', () => {
    const catalog = mutableCatalog();
    replaceEntry(catalog, 'layout', { stage: 'upgrade' });
    expect(() => validateGuideCatalog(catalog)).toThrow(
      /reactive-state\.prerequisites: completed entry depends on non-complete "layout"/u,
    );
  });

  test('should reject missing and unregistered completion evidence independently', () => {
    const belowTarget = mutableCatalog();
    replaceEntry(belowTarget, 'layout', { examples: [] });
    expect(() => validateGuideCatalog(belowTarget)).toThrow(/layout\.examples.*live-example target/iu);

    const layout = mutableCatalog().entries.find((entry) => entry.id === 'layout');
    const missingExampleId = layout?.examples[0];
    if (missingExampleId === undefined) throw new Error('missing Layout example fixture');
    const registered = new Set(REGISTERED_IDS);
    registered.delete(missingExampleId);
    expect(() =>
      parseGuideCatalog(CATALOG_SOURCE, 'guides.json', {
        registeredExampleIds: [...registered],
      }),
    ).toThrow(`layout.examples: unregistered example "${missingExampleId}"`);
  });

  test('should reject malformed external validation evidence', () => {
    expect(() => validateGuideCatalog(JSON.parse(CATALOG_SOURCE), { registeredExampleIds: [''] })).toThrow(
      /registeredExampleIds\[0\].*non-empty string/iu,
    );
    expect(() => Reflect.apply(validateGuideCatalog, undefined, [JSON.parse(CATALOG_SOURCE), { extra: [] }])).toThrow(
      /catalog validation options\.extra: unknown field/u,
    );
  });

  test('should revalidate caller-owned entries before projecting navigation', () => {
    const catalog = mutableCatalog();
    const introduction = catalog.entries.find((entry) => entry.id === 'introduction');
    if (introduction === undefined) throw new Error('missing Introduction fixture');
    replaceEntry(catalog, 'install-and-packages', { page: introduction.page });
    expect(() => projectGuideNavigation(catalog.entries)).toThrow(/catalog\.entries\.page.*duplicate/iu);
  });

  test('should freeze the validated root, entries, and caller-owned arrays', () => {
    const catalog: GuideCatalog = parseGuideCatalog(CATALOG_SOURCE);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.entries)).toBe(true);
    expect(Object.isFrozen(catalog.entries[0])).toBe(true);
    expect(Object.isFrozen(catalog.entries[0]?.prerequisites)).toBe(true);
  });
});
