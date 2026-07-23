// Specification oracle for the generated plugin API reference (references/api/*.md).
//
// The reference lets a jsvision app author consult exact signatures instead of reading the SDK
// source. These checks pin the guarantees that make it trustworthy: it covers exactly the public
// barrel surface of every JSVision package, the committed pages equal a fresh
// generation (no drift), generation is deterministic, and the pages carry real signatures.
// Immutable oracle: if a generated page disagrees, the generator is wrong — never this test.

import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import {
  generateApiDocs,
  checkApiDrift,
  categoryFor,
  CATEGORIES,
  compareApiNames,
  firstLineDifference,
} from '../../../scripts/gen-plugin-api.mjs';
import { barrelExports } from '../../docs-site/src/api/barrel-exports.mjs';

const entry = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const CORE = entry('../../core/src/engine/index.ts');
const UI = entry('../../ui/src/index.ts');
const FORMS = entry('../../forms/src/index.ts');
const DATAGRID = entry('../../datagrid/src/index.ts');
const WEB = entry('../../web/src/index.ts');
const FILES = entry('../../files/src/index.ts');

// Generate once (each generation runs the TypeScript compiler over six barrels) and reuse.
const generated = generateApiDocs();

// ST-A1 — coverage: every public export across the three barrels is documented, and nothing extra.
test('ST-A1: the API reference covers exactly the public barrel surface', () => {
  const documented = new Set(generated.names);
  const surface = new Set<string>([
    ...barrelExports(CORE),
    ...barrelExports(UI),
    ...barrelExports(FORMS),
    ...barrelExports(DATAGRID),
    ...barrelExports(WEB),
    ...barrelExports(FILES),
  ]);
  expect([...surface].filter((n) => !documented.has(n))).toEqual([]); // nothing missing
  expect([...documented].filter((n) => !surface.has(n))).toEqual([]); // nothing invented
});

// ST-A2 — the committed pages equal a fresh generation (the drift guard is green).
test('ST-A2: the committed API reference is in sync with the source', () => {
  expect(checkApiDrift()).toEqual([]);
});

// ST-A3 — determinism: a second generation is byte-identical, so the drift guard never false-fires.
test('ST-A3: generation is deterministic', () => {
  expect(generateApiDocs().files).toEqual(generated.files);
});

// ST-A4 — the pages carry real option fields + signatures, not just headings.
test('ST-A4: pages carry real option fields and signatures', () => {
  expect(generated.files['data-views.md']).toContain('interface DataGridOptions<T>');
  expect(generated.files['data-views.md']).toContain('rows: Signal<T[]>');
  expect(generated.files['controls.md']).toContain('interface ButtonOptions');
  expect(generated.files['index.md']).toContain('Data views');
});

// ST-A5 — index integrity: every category page the index links to was actually generated.
test('ST-A5: every category linked from the index exists', () => {
  for (const c of CATEGORIES) {
    if (generated.files['index.md'].includes(`./${c.slug}.md`)) {
      expect(generated.files[`${c.slug}.md`]).toBeDefined();
    }
  }
});

// ST-A6 — categorization: web/files map to their package page; a ui subsystem maps by source segment.
test('ST-A6: exports route to the expected category', () => {
  expect(categoryFor('web', 'packages/web/src/host.ts')).toBe('web');
  expect(categoryFor('files', 'packages/files/src/dialog/file-dialog.ts')).toBe('files');
  expect(categoryFor('forms', 'packages/forms/src/create-form.ts')).toBe('forms');
  expect(categoryFor('datagrid', 'packages/datagrid/src/grid.ts')).toBe('datagrid');
  expect(categoryFor('core', 'packages/core/src/engine/color/theme.ts')).toBe('core-essentials');
  expect(categoryFor('ui', 'packages/ui/src/table/columns.ts')).toBe('data-views');
  expect(categoryFor('ui', 'packages/core/dist/engine/color/theme.d.ts')).toBe('core-essentials');
});

// ST-A7 — ordering and diagnostics must not depend on the runner's locale or hide the actual drift.
test('ST-A7: API ordering is code-point deterministic and drift identifies the first changed line', () => {
  expect(['aa', 'Z', 'a', 'A', 'z'].sort(compareApiNames)).toEqual(['A', 'Z', 'a', 'aa', 'z']);
  expect(firstLineDifference('same\nold\nlast\n', 'same\nnew\nlast\n')).toBe(
    'line 2: committed "old"; generated "new"',
  );
});
