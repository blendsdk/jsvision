import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

describe('configuration-driven i18n package registration', () => {
  test('registers exactly five safe package definitions including Code Editor', () => {
    const config = JSON.parse(readFileSync(join(repoRoot, 'tools/i18n-locale-exports.json'), 'utf8')) as {
      readonly packages: readonly { readonly name: string; readonly symbolPrefix: string }[];
      readonly locales: readonly string[];
    };
    expect(config.packages).toContainEqual({ name: 'code-editor', symbolPrefix: 'codeEditor' });
    expect(config.packages).toHaveLength(5);
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

  test('derives literal ownership from package configuration and leaves human review evidence unmodified', () => {
    const literals = readFileSync(join(repoRoot, 'scripts/check-i18n-literals.mjs'), 'utf8');
    const reviews = JSON.parse(readFileSync(join(repoRoot, 'tools/i18n-translation-reviews.json'), 'utf8')) as {
      readonly reviews: readonly { readonly package: string }[];
    };
    expect(literals).toContain('i18n-locale-exports.json');
    expect(literals).toMatch(/config\.packages\.map\(\(\{\s*name\s*\}\)\s*=>\s*`packages\/\$\{name\}\/src`\)/u);
    expect(literals).not.toMatch(/SOURCE_ROOTS\s*=\s*\[/u);
    expect(reviews.reviews.some((review) => review.package === 'code-editor')).toBe(false);
  });
});
