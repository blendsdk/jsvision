// Specification oracle for the generated plugin API reference (references/api/*.md).
//
// The reference lets a jsvision app author consult exact signatures instead of reading the SDK
// source. These checks pin the guarantees that make it trustworthy: it covers exactly the public
// barrel surface of every JSVision package, the committed pages equal a fresh
// generation (no drift), generation is deterministic, and the pages carry real signatures.
// Immutable oracle: if a generated page disagrees, the generator is wrong — never this test.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import {
  generateApiDocs,
  checkApiDrift,
  categoryFor,
  CATEGORIES,
  compareApiNames,
  firstLineDifference,
  PACKAGES,
} from '../../../scripts/gen-plugin-api.mjs';
import { barrelExports } from '../../docs-site/src/api/barrel-exports.mjs';

const entry = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const CORE = entry('../../core/src/engine/index.ts');
const UI = entry('../../ui/src/index.ts');
const FORMS = entry('../../forms/src/index.ts');
const DATAGRID = entry('../../datagrid/src/index.ts');
const CODE_EDITOR = entry('../../code-editor/src/index.ts');
const WEB = entry('../../web/src/index.ts');
const FILES = entry('../../files/src/index.ts');
const KANBAN = entry('../../kanban/src/index.ts');
const REPOSITORY_ROOT = entry('../../../');

/** Reads one UTF-8 repository artifact through a path fixed by this specification. */
const artifact = (...segments: readonly string[]): string => readFileSync(join(REPOSITORY_ROOT, ...segments), 'utf8');

// Generate once (each generation runs the TypeScript compiler over every registered barrel) and reuse.
const generated = generateApiDocs();

// ST-A1 — coverage: every public export across the registered barrels is documented, and nothing extra.
test('ST-A1: the API reference covers exactly the public barrel surface', () => {
  const documented = new Set(generated.names);
  const surface = new Set<string>([
    ...barrelExports(CORE),
    ...barrelExports(UI),
    ...barrelExports(FORMS),
    ...barrelExports(DATAGRID),
    ...barrelExports(CODE_EDITOR),
    ...barrelExports(WEB),
    ...barrelExports(FILES),
    ...barrelExports(KANBAN),
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
  expect(generated.files['datagrid.md']).toContain('const gridKeymap: import("@jsvision/ui").Keymap');
  expect(generated.files['kanban.md'] ?? '').toContain('new KanbanBoard<TCard>(options: KanbanBoardOptions<TCard>)');
  expect(generated.files['kanban.md'] ?? '').toContain(
    'new KanbanViewport<TCard>(options: KanbanViewportOptions<TCard>)',
  );
  expect(Object.values(generated.files).join('\n')).not.toMatch(/import\(["'](?:\/|[A-Za-z]:[\\/])/);
  expect(generated.files['index.md']).toContain('Data views');
  expect(generated.files['index.md']).toContain('@jsvision/kanban');
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
  expect(categoryFor('code-editor', 'packages/code-editor/src/index.ts')).toBe('code-editor');
  expect(categoryFor('kanban', 'packages/kanban/src/index.ts')).toBe('kanban');
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

// Kanban is a first-class stable package and owns a dedicated generated lookup page.
test('ST-A8: the canonical API generator registers the complete Kanban package category', () => {
  expect(PACKAGES.map(({ pkg }) => pkg)).toEqual([
    'core',
    'i18n',
    'ui',
    'forms',
    'datagrid',
    'code-editor',
    'files',
    'web',
    'kanban',
  ]);
  expect(CATEGORIES.find(({ slug }) => slug === 'kanban')).toEqual({
    slug: 'kanban',
    title: '@jsvision/kanban — responsive terminal task boards',
    blurb: 'Board and viewport composition, generic sources, cards, themes, localization, and application authority.',
    importPath: '@jsvision/kanban',
  });
});

// The complete Phase B public surface must remain represented on the dedicated generated lookup page.
test('ST-B-X-06: generated Kanban API and plugin impact mapping cover the current SDK surface', () => {
  const page = generated.files['kanban.md'] ?? '';
  for (const symbol of [
    'KanbanCardPresentationAdapter',
    'KanbanInteractionFacade',
    'KanbanStructurePolicy',
    'createKanbanInteractionController',
    'resolveKanbanPresentation',
  ]) {
    expect(page, symbol).toContain(symbol);
  }

  const impact = JSON.parse(artifact('tools', 'jsvision-plugin-impact.json')) as {
    readonly areas: readonly {
      readonly name: string;
      readonly paths: readonly string[];
      readonly references: readonly string[];
    }[];
  };
  expect(impact.areas.find(({ name }) => name === 'kanban')).toEqual({
    name: 'kanban',
    paths: [
      'packages/kanban/src',
      'packages/kanban/package.json',
      'packages/kanban/README.md',
      'packages/docs-site/api/kanban',
      'docs/architecture/kanban.md',
    ],
    references: ['references/architecture.md', 'references/component-catalog.md', 'references/api/kanban.md'],
  });
});

// Phase B owns truthful package/technical/skill documentation but deliberately defers teaching and showcase surfaces.
test('ST-B-X-07: closure docs describe mounted interaction without registering deferred Kanban examples', () => {
  const readme = artifact('packages', 'kanban', 'README.md');
  const architecture = artifact('docs', 'architecture', 'kanban.md');
  const skillArchitecture = artifact('tools', 'jsvision-skill', 'references', 'architecture.md');
  const componentCatalog = artifact('tools', 'jsvision-skill', 'references', 'component-catalog.md');

  expect(readme).toContain('## Interaction and intents');
  expect(readme).toContain('createKanbanInteractionController');
  expect(readme).not.toContain('This release is the publishable read-only foundation.');
  expect(architecture).toContain('KanbanInteractionFacade');
  expect(architecture).toContain('keyboard and pointer');
  expect(skillArchitecture).toContain('selection');
  expect(skillArchitecture).toContain('application intent');
  expect(skillArchitecture).not.toContain('Phase A provides read-only projection');
  expect(componentCatalog).not.toContain('responsive read-only task-board foundation');

  const componentRoot = join(REPOSITORY_ROOT, 'packages', 'docs-site', 'components');
  const componentKanbanFiles = readdirSync(componentRoot, { recursive: true })
    .filter((path): path is string => typeof path === 'string')
    .map((path) => relative(componentRoot, join(componentRoot, path)))
    .filter((path) => basename(path).toLocaleLowerCase().includes('kanban'));
  expect(componentKanbanFiles).toEqual([]);
  expect(artifact('packages', 'docs-site', 'examples', 'index.ts')).not.toMatch(/['"][^'"]*kanban[^'"]*['"]/iu);
  expect(existsSync(join(REPOSITORY_ROOT, 'packages', 'examples', 'kanban-showcase'))).toBe(false);
  expect(artifact('packages', 'examples', 'package.json')).not.toContain('demo:kanban');
});
