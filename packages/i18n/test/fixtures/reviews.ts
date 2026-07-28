/** Package families that publish independently reviewed framework catalogs. */
export type ReviewedPackage = 'ui' | 'forms' | 'files' | 'datagrid' | 'code-editor';

/** Locale tags covered by the official framework catalog set. */
export type ReviewedLocale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it' | 'pt-PT' | 'pl' | 'ro' | 'sv';

/** Immutable translation-review evidence consumed by release verification. */
export interface TranslationReviewFixture {
  readonly package: ReviewedPackage;
  readonly locale: ReviewedLocale;
  readonly catalogDigest: `sha256:${string}`;
  readonly reviewer: {
    readonly id: string;
    readonly reviewMethod: 'ai-assisted' | 'proficient-human';
  };
  readonly approvedAt: string;
}

/** Representative method-disclosed approval whose digest matches its reviewed catalog fixture. */
export const approvedReviewFixture: TranslationReviewFixture = Object.freeze({
  package: 'ui',
  locale: 'nl',
  catalogDigest: `sha256:${'1'.repeat(64)}`,
  reviewer: Object.freeze({
    id: 'OpenAI Codex',
    reviewMethod: 'ai-assisted',
  }),
  approvedAt: '2026-01-15T12:00:00.000Z',
});

/** Representative approval retaining an obsolete digest after catalog content changes. */
export const staleReviewFixture: TranslationReviewFixture = Object.freeze({
  ...approvedReviewFixture,
  catalogDigest: `sha256:${'0'.repeat(64)}`,
});
