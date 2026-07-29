/**
 * Data Grid hub topology specifications.
 *
 * The routes, labels, profiles, and example populations are copied from the approved hub
 * information architecture rather than derived from the catalog being tested.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parseComponentCatalog } from '../src/components/component-catalog.mjs';
import { validateComponentPage } from '../src/components/component-pages.mjs';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Immutable topic route and profile oracle in specialist-sidebar order. */
const DATA_GRID_TOPICS = [
  {
    id: 'data-grid/overview',
    file: 'components/data-grid/index.md',
    route: '/components/data-grid/',
    label: 'Overview',
    profile: 'landing',
    examples: ['data-grid/quick-start'],
  },
  {
    id: 'data-grid/data-and-columns',
    file: 'components/data-grid/data-and-columns.md',
    route: '/components/data-grid/data-and-columns',
    label: 'Data & columns',
    profile: 'capability',
    examples: ['data-grid/data-sources', 'data-grid/typed-columns'],
  },
  {
    id: 'data-grid/layout-and-rendering',
    file: 'components/data-grid/layout-and-rendering.md',
    route: '/components/data-grid/layout-and-rendering',
    label: 'Layout & rendering',
    profile: 'capability',
    examples: ['data-grid/layout-freezing', 'data-grid/rendering'],
  },
  {
    id: 'data-grid/sorting-and-filtering',
    file: 'components/data-grid/sorting-and-filtering.md',
    route: '/components/data-grid/sorting-and-filtering',
    label: 'Sorting & filtering',
    profile: 'capability',
    examples: ['data-grid/sorting', 'data-grid/quick-filter', 'data-grid/advanced-filter'],
  },
  {
    id: 'data-grid/rows-selection-navigation',
    file: 'components/data-grid/rows-selection-navigation.md',
    route: '/components/data-grid/rows-selection-navigation',
    label: 'Rows, selection & navigation',
    profile: 'capability',
    examples: ['data-grid/selection-navigation', 'data-grid/row-mutations'],
  },
  {
    id: 'data-grid/editing-and-editors',
    file: 'components/data-grid/editing-and-editors.md',
    route: '/components/data-grid/editing-and-editors',
    label: 'Editing & cell editors',
    profile: 'capability',
    examples: [
      'data-grid/editing-lifecycle',
      'data-grid/editor-types',
      'data-grid/custom-editor',
      'data-grid/dirty-commit',
    ],
  },
  {
    id: 'data-grid/validation-and-lifecycle',
    file: 'components/data-grid/validation-and-lifecycle.md',
    route: '/components/data-grid/validation-and-lifecycle',
    label: 'Validation & lifecycle',
    profile: 'capability',
    examples: ['data-grid/validation', 'data-grid/lifecycle-states'],
  },
  {
    id: 'data-grid/footer-and-detail',
    file: 'components/data-grid/footer-and-detail.md',
    route: '/components/data-grid/footer-and-detail',
    label: 'Footer, aggregation & detail',
    profile: 'capability',
    examples: ['data-grid/aggregates', 'data-grid/master-detail'],
  },
  {
    id: 'data-grid/data-at-scale',
    file: 'components/data-grid/data-at-scale.md',
    route: '/components/data-grid/data-at-scale',
    label: 'Data at scale',
    profile: 'capability',
    examples: ['data-grid/windowed', 'data-grid/large-memory'],
  },
  {
    id: 'data-grid/export-and-personalization',
    file: 'components/data-grid/export-and-personalization.md',
    route: '/components/data-grid/export-and-personalization',
    label: 'Export & personalization',
    profile: 'capability',
    examples: ['data-grid/export', 'data-grid/variants-personalization'],
  },
  {
    id: 'data-grid/theming-accessibility-performance',
    file: 'components/data-grid/theming-accessibility-performance.md',
    route: '/components/data-grid/theming-accessibility-performance',
    label: 'Theming, accessibility & performance',
    profile: 'capability',
    examples: ['data-grid/theming-accessibility', 'data-grid/performance-boundaries'],
  },
  {
    id: 'data-grid/api',
    file: 'components/data-grid/api.md',
    route: '/components/data-grid/api',
    label: 'API map',
    profile: 'api',
    examples: [],
  },
] as const;

describe('Data Grid catalog and page topology', () => {
  test('catalog topics exactly match the approved specialist order and profiles', async () => {
    const source = await readFile(join(PACKAGE_ROOT, 'components.json'), 'utf8');
    const catalog = parseComponentCatalog(source);
    const actual = catalog.entries
      .flatMap((entry) => (entry.kind === 'topic' && entry.hub === 'data-grid' ? [entry] : []))
      .sort((left, right) => left.sidebarOrder - right.sidebarOrder)
      .map((entry) => ({
        id: entry.id,
        route: entry.page,
        label: entry.title,
        profile: entry.profile,
        examples: entry.examples,
      }));
    expect(actual).toEqual(
      DATA_GRID_TOPICS.map(({ id, route, label, profile, examples }) => ({
        id,
        route,
        label,
        profile,
        examples,
      })),
    );
  });

  test.each(DATA_GRID_TOPICS)('$route satisfies its $profile page contract', async (topic) => {
    const source = await readFile(join(PACKAGE_ROOT, topic.file), 'utf8');
    const evidence = validateComponentPage(source, {
      filePath: topic.file,
      profile: topic.profile,
      expectedExamples: topic.examples,
    });
    expect(evidence.exampleIds).toEqual(topic.examples);
  });
});

describe('Data Grid specialist sidebar', () => {
  test('uses the exact prefix, ordered links, and no obsolete component route', async () => {
    const source = await readFile(join(PACKAGE_ROOT, '.vitepress/config.ts'), 'utf8');
    expect(source).toContain("'/components/data-grid/':");
    let cursor = source.indexOf("'/components/data-grid/':");
    for (const topic of DATA_GRID_TOPICS) {
      const next = source.indexOf(`link: '${topic.route}'`, cursor);
      expect(next, `missing or out-of-order Data Grid sidebar link ${topic.route}`).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(source).not.toContain('/components/table/data-grid');
  });

  test('removes the obsolete page and runnable example', async () => {
    await expect(readFile(join(PACKAGE_ROOT, 'components/table/data-grid.md'), 'utf8')).rejects.toThrow();
    await expect(readFile(join(PACKAGE_ROOT, 'examples/table/data-grid.ts'), 'utf8')).rejects.toThrow();
  });
});

export { DATA_GRID_TOPICS };
