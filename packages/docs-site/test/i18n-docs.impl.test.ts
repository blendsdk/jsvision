import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = join(PACKAGE_ROOT, '..', '..');

function readLocaleExportDimensions(): { readonly locales: readonly string[]; readonly packages: readonly string[] } {
  const parsed: unknown = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'tools', 'i18n-locale-exports.json'), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new TypeError('The locale export configuration must be an object.');
  }

  const locales = Reflect.get(parsed, 'locales');
  const packages = Reflect.get(parsed, 'packages');
  if (
    !Array.isArray(locales) ||
    !locales.every((locale) => typeof locale === 'string') ||
    !Array.isArray(packages) ||
    !packages.every(
      (packageConfig) =>
        typeof packageConfig === 'object' &&
        packageConfig !== null &&
        typeof Reflect.get(packageConfig, 'name') === 'string',
    )
  ) {
    throw new TypeError('The locale export configuration has invalid package or locale entries.');
  }

  return {
    locales,
    packages: packages.map((packageConfig) => Reflect.get(packageConfig, 'name')),
  };
}

describe('internationalization documentation hardening', () => {
  test('should publish a generated link for the engine, Node loader, and every configured locale subpath', () => {
    const index = readFileSync(join(PACKAGE_ROOT, 'reference', 'i18n-entry-points.md'), 'utf8');
    const apiLinks = [...index.matchAll(/\]\((\/api\/[^)]+)\)/gu)].map((match) => match[1]);
    const dimensions = readLocaleExportDimensions();

    expect(apiLinks).toHaveLength(2 + dimensions.packages.length * dimensions.locales.length);
    expect(apiLinks).toContain('/api/i18n/');
    expect(apiLinks).toContain('/api/i18n-node/');
    for (const packageName of dimensions.packages) {
      for (const locale of dimensions.locales) {
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
