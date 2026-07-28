/**
 * Translation approval is digest-bound release evidence. A verifier accepts exactly one matching,
 * method-disclosed approval and reports every rejected case with machine-readable package and
 * locale identity, never by parsing prose.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import type { Catalog } from '../src/index.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const VERIFIER_PATH = join(REPO_ROOT, 'scripts', 'check-i18n-reviews.mjs');

interface ReviewIssue {
  readonly code: string;
  readonly packageName: string;
  readonly locale: string;
}

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
  normalizedCatalogDigest(catalog: Catalog): string;
  verifyTranslationReviews(input: {
    readonly catalogs: readonly { readonly packageName: string; readonly catalog: Catalog }[];
    readonly manifest: { readonly schema: 2; readonly reviews: readonly ReviewEntry[] };
  }): readonly ReviewIssue[];
}

async function verifier(): Promise<ReviewVerifier> {
  return (await import(pathToFileURL(VERIFIER_PATH).href)) as ReviewVerifier;
}

const catalog: Catalog = {
  schema: 1,
  locale: 'nl',
  messages: {
    'ui.action.ok': '~O~K',
    'ui.greeting': 'Hallo ${name}',
  },
};
const catalogs = [{ packageName: 'ui', catalog }] as const;

function approval(digest: string, overrides: Partial<ReviewEntry> = {}): ReviewEntry {
  return {
    package: 'ui',
    locale: 'nl',
    digest,
    reviewer: 'reviewer-nl-01',
    reviewMethod: 'ai-assisted',
    reviewedAt: '2026-07-28',
    status: 'approved',
    ...overrides,
  };
}

test.each(['ai-assisted', 'proficient-human'] as const)(
  'accepts one approved %s review matching the normalized catalog digest',
  async (reviewMethod) => {
    const api = await verifier();
    const digest = api.normalizedCatalogDigest(catalog);
    expect(
      api.verifyTranslationReviews({
        catalogs,
        manifest: { schema: 2, reviews: [approval(digest, { reviewMethod })] },
      }),
    ).toEqual([]);
  },
);

test('rejects review evidence without a supported disclosed method', async () => {
  const api = await verifier();
  const digest = api.normalizedCatalogDigest(catalog);
  const issues = api.verifyTranslationReviews({
    catalogs,
    manifest: { schema: 2, reviews: [approval(digest, { reviewMethod: 'automated' })] },
  });
  expect(issues).toContainEqual(
    expect.objectContaining({ code: 'UNAPPROVED_REVIEW', packageName: 'ui', locale: 'nl' }),
  );
});

test.each([
  {
    name: 'missing review',
    reviews: (_digest: string): readonly ReviewEntry[] => [],
  },
  {
    name: 'unapproved review',
    reviews: (digest: string): readonly ReviewEntry[] => [approval(digest, { status: 'pending' })],
  },
  {
    name: 'duplicate review',
    reviews: (digest: string): readonly ReviewEntry[] => [approval(digest), approval(digest)],
  },
  {
    name: 'stale review digest',
    reviews: (_digest: string): readonly ReviewEntry[] => [approval('0'.repeat(64))],
  },
])('rejects $name with structural package and locale identity', async ({ reviews }) => {
  const api = await verifier();
  const issues = api.verifyTranslationReviews({
    catalogs,
    manifest: { schema: 2, reviews: reviews(api.normalizedCatalogDigest(catalog)) },
  });
  expect(issues.length).toBeGreaterThan(0);
  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: expect.any(String),
        packageName: 'ui',
        locale: 'nl',
      }),
    ]),
  );
});
