/**
 * Repository-level hardening for the boundary between Guide courses and specialist component hubs.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '../examples/index.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const GUIDE_ROOT = join(PACKAGE_ROOT, 'guide');
const CATALOG = parseGuideCatalog(readFileSync(join(PACKAGE_ROOT, 'guides.json'), 'utf8'));

/** Catalog-derived specialist ownership information used by every hardening check. */
interface SpecialistBoundary {
  readonly id: string;
  readonly route: string;
  readonly directory: string;
  readonly prerequisiteIds: readonly string[];
}

/** Bounded collector that prevents a broken repository from producing unbounded diagnostics. */
interface DiagnosticCollector {
  /** Retain one diagnostic when capacity remains. */
  add(message: string): void;
  /** Return the retained immutable diagnostic snapshot. */
  entries(): readonly string[];
}

/** Read a UTF-8 Markdown source relative to the docs-site package. */
function readMarkdown(...segments: readonly string[]): string {
  return readFileSync(join(PACKAGE_ROOT, ...segments), 'utf8');
}

/** Extract site-absolute Markdown destinations without fragments or query strings. */
function siteRoutes(source: string): ReadonlySet<string> {
  const routes = [...source.matchAll(/\]\((\/[^)\s#?]+\/?)(?:[?#][^)]*)?\)/gu)].map((match) => match[1] ?? '');
  return new Set(routes);
}

/** Resolve local Markdown links to committed source paths for prerequisite checks. */
function linkedDocumentPaths(source: string, sourcePath: string): ReadonlySet<string> {
  const paths = new Set<string>();
  const links = [...source.matchAll(/\[[^\x5d]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/gu)].map(
    (match) => match[1] ?? '',
  );
  for (const link of links) {
    const target = link.split('#', 1)[0] ?? '';
    if (target === '' || /^(?:https?:|mailto:|tel:)/u.test(target) || target.startsWith('/api/')) continue;
    if (target.startsWith('/')) {
      paths.add(normalize(routeSource(target)));
      continue;
    }
    const absolute = normalize(resolve(dirname(sourcePath), target));
    paths.add(
      target.endsWith('/') ? join(absolute, 'index.md') : extname(absolute) === '' ? `${absolute}.md` : absolute,
    );
  }
  return paths;
}

/** Extract normalized level-one and level-two headings used to detect topic duplication. */
function courseHeadings(source: string): ReadonlySet<string> {
  const headings = [...source.matchAll(/^#{1,2}\s+(.+?)\s*$/gmu)].map((match) =>
    (match[1] ?? '')
      .replace(/`/gu, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
      .trim()
      .toLocaleLowerCase('en'),
  );
  return new Set(headings);
}

/** Resolve the two specialist contracts from the catalog rather than duplicating prerequisite data. */
function specialistBoundaries(): readonly SpecialistBoundary[] {
  return CATALOG.entries
    .filter((entry) => entry.profile === 'specialist')
    .map((entry) => ({
      id: entry.id,
      route: entry.page,
      directory: entry.id === 'data-grid-specialist' ? 'data-grid' : 'code-editor',
      prerequisiteIds: entry.prerequisites,
    }));
}

/** Read every Markdown source directly owned by one specialist component hub. */
function specialistSources(boundary: SpecialistBoundary): readonly string[] {
  const directory = join(PACKAGE_ROOT, 'components', boundary.directory);
  return readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .map((name) => readFileSync(join(directory, name), 'utf8'));
}

/** Read all learner-facing Guide Markdown sources. */
function guideSources(): readonly { readonly name: string; readonly source: string }[] {
  return readdirSync(GUIDE_ROOT)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ name, source: readFileSync(join(GUIDE_ROOT, name), 'utf8') }));
}

/** Map one catalog or Markdown route to its committed source path. */
function routeSource(route: string): string {
  if (route === '/guide/') return join(GUIDE_ROOT, 'index.md');
  if (route.endsWith('/')) return join(PACKAGE_ROOT, route.slice(1), 'index.md');
  return join(PACKAGE_ROOT, `${route.slice(1)}.md`);
}

/** Create a deterministic diagnostic sink with a positive, finite capacity. */
function createDiagnosticCollector(limit: number): DiagnosticCollector {
  const capacity = Number.isSafeInteger(limit) && limit > 0 ? limit : 1;
  const diagnostics: string[] = [];
  return {
    add: (message) => {
      if (diagnostics.length < capacity) diagnostics.push(message);
    },
    entries: () => Object.freeze([...diagnostics]),
  };
}

/** Audit routes, prerequisite links, registry evidence, and internal absolute links in one pass. */
function collectCurriculumDiagnostics(limit = 64): readonly string[] {
  const collector = createDiagnosticCollector(limit);
  const registered = new Set(EXAMPLES.map((entry) => entry.id));
  const byId = new Map(CATALOG.entries.map((entry) => [entry.id, entry] as const));

  for (const entry of CATALOG.entries) {
    const path = routeSource(entry.page);
    if (!existsSync(path)) {
      collector.add(`${entry.id}: missing route ${entry.page}`);
      continue;
    }
    const source = readFileSync(path, 'utf8');
    const routes = siteRoutes(source);
    const linkedPaths = linkedDocumentPaths(source, path);
    for (const prerequisiteId of entry.prerequisites) {
      const prerequisite = byId.get(prerequisiteId);
      if (prerequisite === undefined || !linkedPaths.has(normalize(routeSource(prerequisite.page)))) {
        collector.add(`${entry.id}: missing prerequisite ${prerequisiteId}`);
      }
    }
    for (const exampleId of entry.examples) {
      if (!registered.has(exampleId)) collector.add(`${entry.id}: unregistered example ${exampleId}`);
    }
    for (const route of routes) {
      if (!route.startsWith('/api/') && !existsSync(routeSource(route))) {
        collector.add(`${entry.id}: unresolved route ${route}`);
      }
    }
  }

  const declaredGuideExamples = new Set(CATALOG.entries.flatMap((entry) => entry.examples));
  for (const example of EXAMPLES.filter((entry) => entry.id.startsWith('guides/'))) {
    if (!declaredGuideExamples.has(example.id)) collector.add(`orphan Guide example ${example.id}`);
  }
  return collector.entries();
}

describe('Specialist course boundary hardening', () => {
  test('should keep every catalog prerequisite and specialist hub linked in both directions', () => {
    for (const boundary of specialistBoundaries()) {
      const hubRoutes = siteRoutes(readMarkdown('components', boundary.directory, 'index.md'));
      expect(hubRoutes.has('/guide/'), `${boundary.id}: Guide curriculum return`).toBe(true);

      for (const prerequisiteId of boundary.prerequisiteIds) {
        const prerequisiteRoutes = siteRoutes(readMarkdown('guide', `${prerequisiteId}.md`));
        expect(prerequisiteRoutes.has(boundary.route), `${prerequisiteId} → ${boundary.id}`).toBe(true);
        expect(hubRoutes.has(`/guide/${prerequisiteId}`), `${boundary.id} → ${prerequisiteId}`).toBe(true);
      }
    }
  });

  test('should keep specialist page topics out of the Guide course heading inventory', () => {
    const guides = guideSources();
    const guideHeadings = new Map(guides.map(({ name, source }) => [name, courseHeadings(source)]));

    for (const boundary of specialistBoundaries()) {
      const ownedHeadings = new Set(specialistSources(boundary).flatMap((source) => [...courseHeadings(source)]));
      for (const [guideName, headings] of guideHeadings) {
        const duplicates = [...ownedHeadings].filter((heading) => headings.has(heading));
        expect(duplicates, `${guideName} duplicates ${boundary.id} topics`).toEqual([]);
      }
    }
  });

  test('should keep specialist identities out of Guide filenames and catalog routes', () => {
    const guideNames = new Set(guideSources().map(({ name }) => name));
    expect(guideNames.has('data-grid.md')).toBe(false);
    expect(guideNames.has('code-editor.md')).toBe(false);

    for (const boundary of specialistBoundaries()) {
      expect(boundary.route.startsWith('/components/')).toBe(true);
      expect(CATALOG.entries.some((entry) => entry.page === `/guide/${boundary.directory}`)).toBe(false);
    }
  });
});

describe('Curriculum batch-diagnostic hardening', () => {
  test('should report no route, prerequisite, registry, or evidence drift in one bounded pass', () => {
    expect(collectCurriculumDiagnostics()).toEqual([]);
  });

  test('should cap retained diagnostics even when every observed item fails', () => {
    const collector = createDiagnosticCollector(8);
    for (let index = 0; index < 100; index += 1) collector.add(`failure-${index}`);
    expect(collector.entries()).toEqual([
      'failure-0',
      'failure-1',
      'failure-2',
      'failure-3',
      'failure-4',
      'failure-5',
      'failure-6',
      'failure-7',
    ]);
  });
});
