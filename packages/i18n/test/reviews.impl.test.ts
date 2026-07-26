import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import type { Catalog } from '../src/index.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const VERIFIER_PATH = join(REPO_ROOT, 'scripts', 'check-i18n-reviews.mjs');

test('should reject an approved review with an impossible calendar date', async () => {
  const api = (await import(pathToFileURL(VERIFIER_PATH).href)) as {
    normalizedCatalogDigest(catalog: Catalog): string;
    verifyTranslationReviews(input: {
      readonly catalogs: readonly { readonly packageName: string; readonly catalog: Catalog }[];
      readonly manifest: { readonly schema: 1; readonly reviews: readonly unknown[] };
    }): readonly { readonly code: string }[];
  };
  const catalog: Catalog = {
    schema: 1,
    locale: 'nl',
    messages: { greeting: 'Hallo' },
  };
  const issues = api.verifyTranslationReviews({
    catalogs: [{ packageName: 'ui', catalog }],
    manifest: {
      schema: 1,
      reviews: [
        {
          package: 'ui',
          locale: 'nl',
          digest: api.normalizedCatalogDigest(catalog),
          reviewer: 'reviewer-nl-01',
          proficiency: 'proficient',
          reviewedAt: '2026-99-99',
          status: 'approved',
        },
      ],
    },
  });

  expect(issues).toContainEqual(expect.objectContaining({ code: 'UNAPPROVED_REVIEW' }));
});

test('should block release preparation on translation review evidence before version changes', () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
    readonly scripts?: Readonly<Record<string, string>>;
  };

  expect(manifest.scripts?.['release:prepare']).toMatch(/^yarn lockstep:version /u);
  expect(manifest.scripts?.['lockstep:version']).toMatch(/^yarn i18n:reviews:check &&/u);
});
