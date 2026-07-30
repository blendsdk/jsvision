/**
 * Specification coverage for the Guide curriculum catalog and prime directive.
 *
 * The catalog is the complete learning-path source of truth. Planned courses remain visible in the
 * curriculum without becoming dead sidebar links, while every navigable entry resolves to a real
 * page. Course completion requires the repository-level guide directive and registered examples.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import vitepressConfig from '../.vitepress/config.js';
import { EXAMPLES } from '../examples/index.js';
import {
  parseGuideCatalog,
  projectGuideNavigation,
  type GuideCatalog,
  type GuideCatalogEntry,
} from '../src/guides/guide-catalog.mjs';

const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PACKAGE_ROOT = join(REPOSITORY_ROOT, 'packages', 'docs-site');
const CATALOG_SOURCE = readFileSync(join(PACKAGE_ROOT, 'guides.json'), 'utf8');
const CATALOG = parseGuideCatalog(CATALOG_SOURCE);
const DIRECTIVE = readFileSync(join(REPOSITORY_ROOT, 'AGENTS.md'), 'utf8');
const CURRICULUM = readFileSync(join(PACKAGE_ROOT, 'guide', 'index.md'), 'utf8');
const GUIDE_ROOT = join(PACKAGE_ROOT, 'guide');
const GUIDE_SOURCES = readdirSync(GUIDE_ROOT)
  .filter((name) => name.endsWith('.md'))
  .map((name) => ({ name, source: readFileSync(join(GUIDE_ROOT, name), 'utf8') }));

const SPECIALIST_CONTRACTS = [
  {
    id: 'data-grid-specialist',
    route: '/components/data-grid/',
    hubPath: join(PACKAGE_ROOT, 'components', 'data-grid', 'index.md'),
    prerequisites: ['reactive-state', 'scrolling-lists-and-large-content', 'forms'],
    forbiddenGuideHeadings: [
      '# Data Grid',
      '## Data & columns',
      '## Sorting & filtering',
      '## Editing & cell editors',
      '## Data at scale',
    ],
  },
  {
    id: 'code-editor-specialist',
    route: '/components/code-editor/',
    hubPath: join(PACKAGE_ROOT, 'components', 'code-editor', 'index.md'),
    prerequisites: ['reactive-state', 'text-unicode-and-cells', 'scrolling-lists-and-large-content'],
    forbiddenGuideHeadings: [
      '# Code Editor',
      '## Documents & lifecycle',
      '## Languages & syntax',
      '## Folding',
      '## Language intelligence',
      '## Viewport & large documents',
    ],
  },
] as const;

const EXPECTED_IDS = [
  'introduction',
  'install-and-packages',
  'codex-plugin',
  'layout',
  'reactive-state',
  'views-and-focus',
  'events-commands-and-keymaps',
  'keyboard-and-clipboard',
  'text-unicode-and-cells',
  'scrolling-lists-and-large-content',
  'application-shell',
  'dialogs-and-modality',
  'async-work',
  'forms',
  'files-and-filesystem',
  'i18n',
  'screens-and-routing',
  'theming-and-colour-depth',
  'running-in-the-browser',
  'writing-your-own-widget',
  'testing-headlessly',
  'application-architecture',
  'data-grid-specialist',
  'code-editor-specialist',
  'debugging',
  'crash-safety',
  'untrusted-text',
  'accessibility',
  'terminal-capabilities',
  'in-production',
  'complete-application',
] as const;

interface SidebarItem {
  readonly text: string;
  readonly link: string;
}

interface SidebarGroup {
  readonly text: string;
  readonly items: readonly SidebarItem[];
}

/** Read the concrete Guide sidebar from the real VitePress configuration. */
function guideSidebar(): readonly SidebarGroup[] {
  const config = vitepressConfig as {
    readonly themeConfig?: { readonly sidebar?: Readonly<Record<string, unknown>> };
  };
  const sidebar = config.themeConfig?.sidebar?.['/guide/'];
  if (!Array.isArray(sidebar)) throw new TypeError('VitePress must expose a /guide/ sidebar');
  return sidebar as readonly SidebarGroup[];
}

/** Convert a site-absolute documentation route to its Markdown source. */
function routeSource(route: string): string {
  if (route === '/guide/') return join(PACKAGE_ROOT, 'guide', 'index.md');
  if (route.startsWith('/guide/')) return join(PACKAGE_ROOT, `${route.slice(1)}.md`);
  if (route.endsWith('/')) return join(PACKAGE_ROOT, route.slice(1), 'index.md');
  return join(PACKAGE_ROOT, `${route.slice(1)}.md`);
}

describe('Guide curriculum catalog', () => {
  test('declares the complete confirmed curriculum in stable order', () => {
    expect(CATALOG.schemaVersion).toBe(1);
    expect(CATALOG.entries.map((entry) => entry.id)).toEqual(EXPECTED_IDS);
    expect(CATALOG.entries).toHaveLength(31);
    expect(CATALOG.entries.filter((entry) => entry.stage === 'complete').map((entry) => entry.id)).toEqual([
      'introduction',
      'install-and-packages',
      'codex-plugin',
      'layout',
      'reactive-state',
      'views-and-focus',
      'events-commands-and-keymaps',
      'keyboard-and-clipboard',
      'text-unicode-and-cells',
      'scrolling-lists-and-large-content',
      'application-shell',
      'dialogs-and-modality',
      'async-work',
      'forms',
      'files-and-filesystem',
      'i18n',
      'screens-and-routing',
      'theming-and-colour-depth',
      'running-in-the-browser',
      'writing-your-own-widget',
      'testing-headlessly',
      'application-architecture',
      'data-grid-specialist',
      'code-editor-specialist',
      'debugging',
      'crash-safety',
      'untrusted-text',
      'accessibility',
      'terminal-capabilities',
      'in-production',
      'complete-application',
    ]);
    expect(CATALOG.entries.filter((entry) => entry.stage === 'planned')).toHaveLength(0);
  });

  test('gives every course prerequisites, outcomes, and an explicit example target', () => {
    for (const entry of CATALOG.entries) {
      expect(entry.learningOutcomes.length, `${entry.id}: learning outcomes`).toBeGreaterThanOrEqual(2);
      expect(new Set(entry.learningOutcomes).size, `${entry.id}: duplicate outcomes`).toBe(
        entry.learningOutcomes.length,
      );
      expect(entry.requiredLiveExamples, `${entry.id}: example target`).toBeGreaterThanOrEqual(0);
      if (entry.profile === 'course' && entry.requiredLiveExamples === 0) {
        expect(entry.liveExampleException, `${entry.id}: course lab exception`).not.toBeNull();
      }
    }
  });

  test('projects only real, non-planned pages into the visible sidebar', () => {
    const projected = projectGuideNavigation(CATALOG.entries);
    expect(guideSidebar()).toEqual(
      projected.map((group) => ({
        text: group.text,
        items: group.items.map(({ text, link }) => ({ text, link })),
      })),
    );

    const visibleIds = new Set(projected.flatMap((group) => group.items.map((item) => item.id)));
    for (const entry of CATALOG.entries) {
      expect(visibleIds.has(entry.id), entry.id).toBe(entry.stage !== 'planned');
      if (entry.stage !== 'planned') expect(readFileSync(routeSource(entry.page), 'utf8')).not.toHaveLength(0);
    }
  });

  test('requires completed courses to own their declared registered examples', () => {
    const registered = new Set(EXAMPLES.map((example) => example.id));
    for (const entry of CATALOG.entries.filter((candidate) => candidate.stage === 'complete')) {
      expect(entry.examples.length, `${entry.id}: completed example count`).toBeGreaterThanOrEqual(
        entry.requiredLiveExamples,
      );
      for (const example of entry.examples) expect(registered.has(example), `${entry.id}: ${example}`).toBe(true);
    }
  });

  test('publishes every catalog title and stage in the learner-facing curriculum', () => {
    for (const entry of CATALOG.entries) {
      expect(CURRICULUM, entry.id).toContain(entry.title);
      expect(CURRICULUM, entry.id).toContain(
        entry.stage === 'planned' ? 'Planned' : entry.stage === 'complete' ? 'Complete' : 'Upgrade',
      );
    }
  });
});

describe('Specialist course ownership and reciprocal navigation', () => {
  test('keeps the two catalog specialists on their exact component hubs with no duplicate Guide routes', () => {
    const specialists = CATALOG.entries.filter((entry) => entry.profile === 'specialist');
    expect(specialists.map(({ id, page }) => ({ id, page }))).toEqual(
      SPECIALIST_CONTRACTS.map(({ id, route }) => ({ id, page: route })),
    );
    expect(specialists).toHaveLength(2);
    expect(CATALOG.entries.filter((entry) => /\/guide\/(?:data-grid|code-editor)(?:\/|$)/u.test(entry.page))).toEqual(
      [],
    );
    for (const duplicate of ['data-grid.md', 'code-editor.md', 'data-grid', 'code-editor']) {
      expect(existsSync(join(GUIDE_ROOT, duplicate)), duplicate).toBe(false);
    }
  });

  test('makes both authoritative component hubs directly reachable from the learner curriculum', () => {
    for (const { id, route } of SPECIALIST_CONTRACTS) {
      expect(CURRICULUM, id).toContain(`](${route})`);
      expect(readFileSync(routeSource(route), 'utf8'), id).not.toHaveLength(0);
      const sidebarItem = guideSidebar()
        .flatMap((group) => group.items)
        .find((item) => item.link === route);
      expect(sidebarItem, id).toBeDefined();
    }
  });

  test.each(SPECIALIST_CONTRACTS)(
    '$id is linked from every catalog prerequisite Guide instead of being re-authored there',
    ({ id, route, prerequisites, forbiddenGuideHeadings }) => {
      for (const prerequisite of prerequisites) {
        const prerequisiteSource = readFileSync(join(GUIDE_ROOT, `${prerequisite}.md`), 'utf8');
        expect(prerequisiteSource, `${id}: ${prerequisite} must link to its owning hub`).toContain(`](${route})`);
      }
      for (const { name, source: guideSource } of GUIDE_SOURCES) {
        for (const heading of forbiddenGuideHeadings) {
          expect(guideSource, `${id}: ${name} duplicates specialist chapter "${heading}"`).not.toMatch(
            new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'mu'),
          );
        }
      }
    },
  );

  test.each(SPECIALIST_CONTRACTS)(
    '$id links learners back to the Guide curriculum and each catalog prerequisite',
    ({ id, hubPath, prerequisites }) => {
      const hub = readFileSync(hubPath, 'utf8');
      expect(hub, `${id}: return to the Guide curriculum`).toContain('](/guide/)');
      for (const prerequisite of prerequisites) {
        expect(hub, `${id}: return to ${prerequisite}`).toContain(`](/guide/${prerequisite})`);
      }
    },
  );
});

describe('Guide course prime directive', () => {
  test('defines the course backbone, snippet standard, live-lab contract, accuracy gate, and specialist boundary', () => {
    const requiredTerms = [
      'guide-course-template1',
      'Learning contract',
      'Course backbone',
      'Code-snippet standard',
      'Live-example standard',
      'Accuracy and completion gate',
      'Data Grid',
      'Code Editor',
      'guides.json',
      'yarn verify',
    ];
    for (const term of requiredTerms) expect(DIRECTIVE).toContain(term);
  });
});

describe('Guide catalog validation', () => {
  test('rejects unknown prerequisites and duplicate navigation positions', () => {
    const parsed = JSON.parse(CATALOG_SOURCE) as GuideCatalog;
    const entries = parsed.entries.map((entry): GuideCatalogEntry => ({ ...entry }));
    entries[0] = { ...entries[0], prerequisites: ['missing-course'] };
    expect(() => parseGuideCatalog(JSON.stringify({ schemaVersion: 1, entries }))).toThrow(/unknown prerequisite/u);

    entries[0] = { ...parsed.entries[0] };
    entries[1] = { ...entries[1], group: entries[0].group, sidebarOrder: entries[0].sidebarOrder };
    expect(() => parseGuideCatalog(JSON.stringify({ schemaVersion: 1, entries }))).toThrow(/sidebar ordering/u);
  });
});
