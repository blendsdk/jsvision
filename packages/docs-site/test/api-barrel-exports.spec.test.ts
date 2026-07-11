/**
 * Specification test (immutable oracle) — the public-barrel export extractor.
 *
 * barrelExports() is the independent ground truth the generated API tree is
 * compared against: it must enumerate exactly a package barrel's PUBLIC exported
 * symbols — following `export *` re-exports transitively, and excluding both
 * never-exported locals and `@internal`-tagged exports (so it matches what the
 * generator emits with excludeInternal). The result is sorted so the downstream
 * coverage/leakage diffs are stable.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { barrelExports } from '../src/api/barrel-exports.mjs';

const BARREL = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'api', 'barrel', 'index.ts');

test('follows named + star re-exports and returns them sorted', () => {
  expect(barrelExports(BARREL)).toEqual(['A', 'B', 'C']);
});

test('excludes never-exported locals and @internal exports', () => {
  const names = barrelExports(BARREL);
  expect(names).not.toContain('internalHelper');
  expect(names).not.toContain('InternalThing');
});
