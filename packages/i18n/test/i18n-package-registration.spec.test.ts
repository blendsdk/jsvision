import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

describe('configuration-driven i18n package registration', () => {
  test('registers exactly six safe package definitions including Kanban', () => {
    const config = JSON.parse(readFileSync(join(repoRoot, 'tools/i18n-locale-exports.json'), 'utf8')) as {
      readonly packages: readonly { readonly name: string; readonly symbolPrefix: string }[];
      readonly locales: readonly string[];
    };
    expect(config.packages).toContainEqual({ name: 'code-editor', symbolPrefix: 'codeEditor' });
    expect(config.packages).toContainEqual({ name: 'kanban', symbolPrefix: 'kanban' });
    expect(config.packages).toHaveLength(6);
    expect(config.locales).toHaveLength(10);
  });

  test('derives generator and review totals from validated configuration', () => {
    const generator = readFileSync(join(repoRoot, 'scripts/update-i18n-locales.mjs'), 'utf8');
    const reviews = readFileSync(join(repoRoot, 'scripts/check-i18n-reviews.mjs'), 'utf8');
    expect(generator).not.toMatch(/packages\.length\s*!==\s*4|40 explicit/u);
    expect(generator).toMatch(/config\.packages\.length\s*\*\s*config\.locales\.length/u);
    expect(reviews).not.toMatch(/36 digest-bound|All 36/u);
    expect(reviews).toContain('i18n-locale-exports.json');
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
});
