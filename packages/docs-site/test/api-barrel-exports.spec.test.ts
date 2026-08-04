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
import { PACKAGES } from '../src/api/packages.mjs';

const DOCS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BARREL = join(DOCS_ROOT, 'test', 'fixtures', 'api', 'barrel', 'index.ts');
const KANBAN_BARREL = join(DOCS_ROOT, '..', 'kanban', 'src', 'index.ts');

test('follows named + star re-exports and returns them sorted', () => {
  expect(barrelExports(BARREL)).toEqual(['A', 'B', 'C']);
});

test('excludes never-exported locals and @internal exports', () => {
  const names = barrelExports(BARREL);
  expect(names).not.toContain('internalHelper');
  expect(names).not.toContain('InternalThing');
});

test('registers the public Kanban barrel in the complete docs API package inventory', () => {
  expect(PACKAGES.map((pkg) => pkg.name)).toEqual([
    'core',
    'i18n',
    'ui',
    'files',
    'forms',
    'datagrid',
    'code-editor',
    'kanban',
  ]);
  expect(PACKAGES.find((pkg) => pkg.name === 'kanban')).toEqual({
    name: 'kanban',
    entry: '../kanban/src/index.ts',
    tsconfig: '../kanban/tsconfig.json',
  });
  expect(barrelExports(KANBAN_BARREL)).toEqual(expect.arrayContaining(['KanbanBoard', 'KanbanViewport']));
});
