import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('internationalization documentation hardening', () => {
  test('should publish a generated link for the engine, Node loader, and all 40 locale subpaths', () => {
    const index = readFileSync(join(PACKAGE_ROOT, 'reference', 'i18n-entry-points.md'), 'utf8');
    const apiLinks = [...index.matchAll(/\]\((\/api\/[^)]+)\)/gu)].map((match) => match[1]);

    expect(apiLinks).toHaveLength(42);
    expect(apiLinks).toContain('/api/i18n/');
    expect(apiLinks).toContain('/api/i18n-node/');
    for (const packageName of ['ui', 'forms', 'files', 'datagrid']) {
      for (const locale of ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt-PT', 'pl', 'ro', 'sv']) {
        expect(index).toContain(`@jsvision/${packageName}/locales/${locale}`);
      }
    }
  });

  test('should keep the localized Theme Designer interactive rather than label-only', () => {
    const example = readFileSync(join(PACKAGE_ROOT, 'examples', 'i18n-theme-designer.ts'), 'utf8');

    expect(example).toMatch(/\bcreateTheme\s*\(/u);
    expect(example).toMatch(/\bListBox\b/u);
    expect(example).toMatch(/\bexecView\b/u);
    expect(example).toMatch(/Commands\.ok/u);
    expect(example).toMatch(/app\.setTheme/u);
    expect(example).toMatch(/cancelButton\s*\(\s*i18n\s*\)/u);
  });
});
