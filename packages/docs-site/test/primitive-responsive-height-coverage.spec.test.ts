/**
 * Population coverage for the standard-example resize policy.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { FIXED_HEIGHT_EXAMPLE_IDS, MIXED_HEIGHT_EXAMPLES } from './contracts/primitive-resize.js';

interface CatalogEntry {
  readonly kind: string;
  readonly complexity?: string;
  readonly examples: readonly string[];
}

test('classifies every standard component example exactly once', () => {
  const catalog = JSON.parse(readFileSync(new URL('../components.json', import.meta.url), 'utf8')) as {
    readonly entries: readonly CatalogEntry[];
  };
  const catalogIds = [
    ...new Set(
      catalog.entries
        .filter((entry) => entry.kind === 'component' && entry.complexity === 'standard')
        .flatMap((entry) => entry.examples),
    ),
  ].sort();
  const classifiedIds = [...FIXED_HEIGHT_EXAMPLE_IDS, ...MIXED_HEIGHT_EXAMPLES.map(([id]) => id)];

  expect(new Set(classifiedIds).size).toBe(classifiedIds.length);
  expect(classifiedIds.slice().sort()).toEqual(catalogIds);
});
