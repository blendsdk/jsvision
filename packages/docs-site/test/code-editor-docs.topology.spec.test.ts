/**
 * Code Editor hub topology specifications.
 *
 * The route, label, profile, and example oracle is copied from the approved specialist-hub
 * information architecture rather than derived from the catalog being tested.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parseComponentCatalog } from '../src/components/component-catalog.mjs';
import { validateComponentPage } from '../src/components/component-pages.mjs';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Immutable Code Editor topic oracle in specialist-sidebar order. */
const CODE_EDITOR_TOPICS = [
  ['code-editor/overview', 'index.md', '/components/code-editor/', 'Overview', 'landing', ['code-editor/quick-start']],
  [
    'code-editor/documents-and-lifecycle',
    'documents-and-lifecycle.md',
    '/components/code-editor/documents-and-lifecycle',
    'Documents & lifecycle',
    'capability',
    ['code-editor/document-controller', 'code-editor/external-changes'],
  ],
  [
    'code-editor/editing-navigation-clipboard',
    'editing-navigation-clipboard.md',
    '/components/code-editor/editing-navigation-clipboard',
    'Editing, navigation & clipboard',
    'capability',
    ['code-editor/editing-navigation', 'code-editor/readonly-clipboard'],
  ],
  [
    'code-editor/languages-and-syntax',
    'languages-and-syntax.md',
    '/components/code-editor/languages-and-syntax',
    'Languages & syntax',
    'capability',
    ['code-editor/language-gallery', 'code-editor/syntax-fallback', 'code-editor/invisibles-line-endings'],
  ],
  [
    'code-editor/folding',
    'folding.md',
    '/components/code-editor/folding',
    'Folding',
    'capability',
    ['code-editor/language-folding', 'code-editor/structural-folding'],
  ],
  [
    'code-editor/search-and-replace',
    'search-and-replace.md',
    '/components/code-editor/search-and-replace',
    'Search & replace',
    'capability',
    ['code-editor/search', 'code-editor/replace'],
  ],
  [
    'code-editor/language-intelligence',
    'language-intelligence.md',
    '/components/code-editor/language-intelligence',
    'Language intelligence & LSP',
    'capability',
    ['code-editor/lsp-completion', 'code-editor/lsp-diagnostics', 'code-editor/lsp-navigation'],
  ],
  [
    'code-editor/viewport-and-large-documents',
    'viewport-and-large-documents.md',
    '/components/code-editor/viewport-and-large-documents',
    'Viewport & large documents',
    'capability',
    ['code-editor/viewport-mouse', 'code-editor/large-document-tiers'],
  ],
  [
    'code-editor/themes-and-fallbacks',
    'themes-and-fallbacks.md',
    '/components/code-editor/themes-and-fallbacks',
    'Themes & fallbacks',
    'capability',
    ['code-editor/themes', 'code-editor/theme-fallback'],
  ],
  [
    'code-editor/host-safety-and-recovery',
    'host-safety-and-recovery.md',
    '/components/code-editor/host-safety-and-recovery',
    'Host safety & recovery',
    'capability',
    ['code-editor/safe-terminal-text', 'code-editor/host-recovery'],
  ],
  ['code-editor/api', 'api.md', '/components/code-editor/api', 'API map', 'api', []],
] as const;

describe('Code Editor catalog and page topology', () => {
  test('catalog topics exactly match the approved specialist order and profiles', async () => {
    const source = await readFile(join(PACKAGE_ROOT, 'components.json'), 'utf8');
    const catalog = parseComponentCatalog(source);
    const actual = catalog.entries
      .flatMap((entry) => (entry.kind === 'topic' && entry.hub === 'code-editor' ? [entry] : []))
      .sort((left, right) => left.sidebarOrder - right.sidebarOrder)
      .map((entry) => ({
        id: entry.id,
        route: entry.page,
        label: entry.title,
        profile: entry.profile,
        examples: entry.examples,
      }));
    expect(actual).toEqual(
      CODE_EDITOR_TOPICS.map(([id, , route, label, profile, examples]) => ({
        id,
        route,
        label,
        profile,
        examples,
      })),
    );
  });

  test.each(CODE_EDITOR_TOPICS)(
    '%s satisfies its selected page contract',
    async (id, file, _route, _label, profile, examples) => {
      const source = await readFile(join(PACKAGE_ROOT, 'components/code-editor', file), 'utf8');
      const evidence = validateComponentPage(source, {
        filePath: `components/code-editor/${file}`,
        profile,
        expectedExamples: examples,
      });
      expect(evidence.exampleIds, id).toEqual(examples);
    },
  );
});

describe('Code Editor specialist sidebar', () => {
  test('uses the exact prefix and ordered links without the obsolete guide route', async () => {
    const source = await readFile(join(PACKAGE_ROOT, '.vitepress/config.ts'), 'utf8');
    expect(source).toContain("'/components/code-editor/':");
    let cursor = source.indexOf("'/components/code-editor/':");
    for (const [, , route] of CODE_EDITOR_TOPICS) {
      const next = source.indexOf(`link: '${route}'`, cursor);
      expect(next, `missing or out-of-order Code Editor sidebar link ${route}`).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(source).not.toContain('/guide/code-editor');
  });

  test('removes the obsolete guide page', async () => {
    await expect(readFile(join(PACKAGE_ROOT, 'guide/code-editor.md'), 'utf8')).rejects.toThrow();
  });
});

export { CODE_EDITOR_TOPICS };
