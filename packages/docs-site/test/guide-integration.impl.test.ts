/**
 * Repository-level hardening for the boundary between Guide courses and specialist component hubs.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
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

/** Read a UTF-8 Markdown source relative to the docs-site package. */
function readMarkdown(...segments: readonly string[]): string {
  return readFileSync(join(PACKAGE_ROOT, ...segments), 'utf8');
}

/** Extract site-absolute Markdown destinations without fragments or query strings. */
function siteRoutes(source: string): ReadonlySet<string> {
  const routes = [...source.matchAll(/\]\((\/[^)\s#?]+\/?)(?:[?#][^)]*)?\)/gu)].map((match) => match[1] ?? '');
  return new Set(routes);
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
