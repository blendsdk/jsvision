import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';
import type { Catalog } from '../src/index.js';

import {
  kanbanDe,
  kanbanEs,
  kanbanFr,
  kanbanIt,
  kanbanNl,
  kanbanPhaseBDe,
  kanbanPhaseBEs,
  kanbanPhaseBFr,
  kanbanPhaseBIt,
  kanbanPhaseBNl,
  kanbanPhaseBPl,
  kanbanPhaseBPtPT,
  kanbanPhaseBRo,
  kanbanPhaseBSv,
  kanbanPl,
  kanbanPtPT,
  kanbanRo,
  kanbanSv,
} from '../../kanban/src/i18n/locales.js';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

interface ReviewEntry {
  readonly package: string;
  readonly locale: string;
  readonly digest: string;
  readonly reviewer: string;
  readonly reviewMethod: string;
  readonly reviewedAt: string;
  readonly status: string;
}

interface ReviewVerifier {
  verifyTranslationReviews(input: {
    readonly catalogs: readonly { readonly packageName: string; readonly catalog: Catalog }[];
    readonly manifest: { readonly schema: number; readonly reviews: readonly ReviewEntry[] };
  }): readonly { readonly code: string; readonly packageName: string; readonly locale: string }[];
}

describe('configuration-driven i18n package registration', () => {
  test('registers exactly six safe package definitions including Kanban', () => {
    const config = JSON.parse(readFileSync(join(repoRoot, 'tools/i18n-locale-exports.json'), 'utf8')) as {
      readonly packages: readonly {
        readonly name: string;
        readonly symbolPrefix: string;
        readonly overlaySymbolPrefixes?: readonly string[];
      }[];
      readonly locales: readonly string[];
    };
    expect(config.packages).toContainEqual({ name: 'code-editor', symbolPrefix: 'codeEditor' });
    expect(config.packages).toContainEqual({
      name: 'kanban',
      symbolPrefix: 'kanban',
      overlaySymbolPrefixes: ['kanbanPhaseB', 'kanbanPhaseC'],
    });
    expect(config.packages).toHaveLength(6);
    expect(config.locales).toHaveLength(10);
  });

  test('derives generator and review totals from validated configuration', () => {
    const generator = readFileSync(join(repoRoot, 'scripts/update-i18n-locales.mjs'), 'utf8');
    const reviews = readFileSync(join(repoRoot, 'scripts/check-i18n-reviews.mjs'), 'utf8');
    expect(generator).not.toMatch(/packages\.length\s*!==\s*4|40 explicit/u);
    expect(generator).toMatch(/config\.packages\.length\s*\*\s*config\.locales\.length/u);
    expect(generator).toContain('overlaySymbolPrefixes');
    expect(generator).not.toMatch(/overlaySymbolPrefix(?!es)/u);
    expect(reviews).not.toMatch(/36 digest-bound|All 36/u);
    expect(reviews).toContain('i18n-locale-exports.json');
    expect(readFileSync(join(repoRoot, 'packages/kanban/src/locales/en.ts'), 'utf8')).toMatch(
      /export \{ kanbanEn, kanbanPhaseBEn, kanbanPhaseCEn \}/u,
    );
  });

  test('records disclosed AI-assisted review evidence for every configured non-English catalog', () => {
    const literals = readFileSync(join(repoRoot, 'scripts/check-i18n-literals.mjs'), 'utf8');
    const reviews = JSON.parse(readFileSync(join(repoRoot, 'tools/i18n-translation-reviews.json'), 'utf8')) as {
      readonly schema: number;
      readonly reviews: readonly {
        readonly package: string;
        readonly locale: string;
        readonly digest: string;
        readonly reviewer: string;
        readonly reviewMethod: string;
        readonly reviewedAt: string;
        readonly status: string;
      }[];
    };
    expect(literals).toContain('i18n-locale-exports.json');
    expect(literals).toMatch(/config\.packages\.map\(\(\{\s*name\s*\}\)\s*=>\s*`packages\/\$\{name\}\/src`\)/u);
    expect(literals).not.toMatch(/SOURCE_ROOTS\s*=\s*\[/u);
    expect(reviews.schema).toBe(2);
    expect(reviews.reviews).toHaveLength(54);
    expect(reviews.reviews.every((review) => review.reviewMethod === 'ai-assisted')).toBe(true);
    expect(new Set(reviews.reviews.map((review) => `${review.package}/${review.locale}`)).size).toBe(54);
    expect(reviews.reviews.every((review) => /^[a-f0-9]{64}$/u.test(review.digest))).toBe(true);
    expect(reviews.reviews.every((review) => review.reviewer.trim().length > 0)).toBe(true);
    expect(reviews.reviews.every((review) => /^\d{4}-\d{2}-\d{2}$/u.test(review.reviewedAt))).toBe(true);
    expect(reviews.reviews.every((review) => review.status === 'approved')).toBe(true);
  });

  test('binds every authored Kanban translation approval to the current complete catalog', async () => {
    const verifier = (await import(
      pathToFileURL(join(repoRoot, 'scripts', 'check-i18n-reviews.mjs')).href
    )) as ReviewVerifier;
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'tools/i18n-translation-reviews.json'), 'utf8')) as {
      readonly schema: number;
      readonly reviews: readonly ReviewEntry[];
    };
    const foundations = [kanbanNl, kanbanDe, kanbanFr, kanbanEs, kanbanIt, kanbanPtPT, kanbanPl, kanbanRo, kanbanSv];
    const overlays = [
      kanbanPhaseBNl,
      kanbanPhaseBDe,
      kanbanPhaseBFr,
      kanbanPhaseBEs,
      kanbanPhaseBIt,
      kanbanPhaseBPtPT,
      kanbanPhaseBPl,
      kanbanPhaseBRo,
      kanbanPhaseBSv,
    ];
    const localeModule: unknown = await import(
      pathToFileURL(join(repoRoot, 'packages', 'kanban', 'src', 'i18n', 'locales.js')).href
    );
    const phaseCNames = [
      'kanbanPhaseCNl',
      'kanbanPhaseCDe',
      'kanbanPhaseCFr',
      'kanbanPhaseCEs',
      'kanbanPhaseCIt',
      'kanbanPhaseCPtPT',
      'kanbanPhaseCPl',
      'kanbanPhaseCRo',
      'kanbanPhaseCSv',
    ] as const;
    if (typeof localeModule !== 'object' || localeModule === null) throw new Error('Invalid Kanban locale module.');
    const phaseCOverlays = phaseCNames.map((name) => Reflect.get(localeModule, name) as Catalog | undefined);
    expect(phaseCOverlays.every((catalog) => catalog !== undefined)).toBe(true);
    const catalogs = foundations.map((foundation, index) => ({
      packageName: 'kanban',
      catalog: {
        schema: foundation.schema,
        locale: foundation.locale,
        messages: {
          ...foundation.messages,
          ...overlays[index].messages,
          ...(phaseCOverlays[index]?.messages ?? {}),
        },
      },
    }));

    const kanbanManifest = {
      ...manifest,
      reviews: manifest.reviews.filter((review) => review.package === 'kanban'),
    };
    expect(verifier.verifyTranslationReviews({ catalogs, manifest: kanbanManifest })).toEqual([]);
  });
});
