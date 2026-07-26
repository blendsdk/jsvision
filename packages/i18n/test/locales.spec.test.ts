/**
 * Public package-locale contracts: isolated subpath exports, canonical catalog identity, strict
 * parity with English, and absence of an eager all-locale registry on each main package entry.
 */
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { validateCatalog } from '../src/index.js';
import type { AcceleratorManifest, Catalog, Message } from '../src/index.js';

const PACKAGE_NAMES = ['ui', 'forms', 'files', 'datagrid', 'code-editor'] as const;
const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt-PT', 'pl', 'ro', 'sv'] as const;
const PACKAGES_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

type PackageName = (typeof PACKAGE_NAMES)[number];
type LocaleTag = (typeof LOCALES)[number];

const MANIFEST_EXPORTS: Readonly<Record<PackageName, string>> = {
  ui: 'UI_ACCELERATOR_MANIFEST',
  forms: 'FORMS_ACCELERATOR_MANIFEST',
  files: 'FILES_ACCELERATOR_MANIFEST',
  datagrid: 'DATAGRID_ACCELERATOR_MANIFEST',
  'code-editor': 'CODE_EDITOR_ACCELERATOR_MANIFEST',
};

/** Load the only catalog value exported by one public locale subpath. */
async function loadCatalog(packageName: PackageName, locale: LocaleTag): Promise<Catalog> {
  const module: Record<string, unknown> = await import(`@jsvision/${packageName}/locales/${locale}`);
  const values = Object.values(module);
  expect(values, `${packageName}/${locale} exports`).toHaveLength(1);
  const catalog = values[0] as Catalog;
  expect(catalog).toMatchObject({ schema: 1, locale: Intl.getCanonicalLocales(locale)[0] });
  return catalog;
}

/** Return the public export-map entry for one package locale. */
async function localeExport(packageName: PackageName, locale: LocaleTag) {
  const manifestPath = resolve(PACKAGES_ROOT, packageName, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    readonly exports?: Readonly<Record<string, { readonly types?: string; readonly import?: string }>>;
  };
  return { manifestPath, mapping: manifest.exports?.[`./locales/${locale}`] };
}

/** Load the package's public accelerator topology from its main entry. */
async function loadAcceleratorManifest(packageName: PackageName): Promise<AcceleratorManifest> {
  const main: Record<string, unknown> = await import(`@jsvision/${packageName}`);
  const manifest = main[MANIFEST_EXPORTS[packageName]] as AcceleratorManifest | undefined;
  expect(manifest).toEqual({ scopes: expect.any(Array) });
  return manifest as AcceleratorManifest;
}

/** Describe a message's stable public shape without retaining its translated bytes. */
function messageKind(message: Message): 'text' | 'plural' | 'select' {
  return typeof message === 'string' ? 'text' : message.kind;
}

/** Extract named placeholders from every string branch of one public message. */
function placeholders(message: Message): readonly string[] {
  const strings = typeof message === 'string' ? [message] : Object.values(message.cases);
  return [
    ...new Set(
      strings.flatMap((value) =>
        [...value.matchAll(/(?<!\$)\$\{([A-Za-z][A-Za-z0-9_]*)\}/gu)]
          .map((match) => match[1])
          .filter((name): name is string => name !== undefined),
      ),
    ),
  ].sort();
}

describe.each(PACKAGE_NAMES)('@jsvision/%s locale exports', (packageName) => {
  test.each(LOCALES)(
    'publishes one canonical schema-1 catalog for %s with runtime and declaration targets',
    async (locale) => {
      await loadCatalog(packageName, locale);
      const { manifestPath, mapping } = await localeExport(packageName, locale);
      expect(mapping).toEqual({
        types: `./dist/locales/${locale}.d.ts`,
        import: `./dist/locales/${locale}.js`,
      });
      await expect(access(resolve(dirname(manifestPath), mapping?.types ?? ''))).resolves.toBeUndefined();
      await expect(access(resolve(dirname(manifestPath), mapping?.import ?? ''))).resolves.toBeUndefined();
    },
  );

  test('keeps every locale exactly aligned with English keys, kinds, and placeholders', async () => {
    const english = await loadCatalog(packageName, 'en');
    const acceleratorManifest = await loadAcceleratorManifest(packageName);
    const englishKeys = Object.keys(english.messages).sort();
    for (const locale of LOCALES) {
      const catalog = await loadCatalog(packageName, locale);
      expect(
        validateCatalog(catalog, {
          mode: 'strict',
          official: true,
          referenceCatalog: english,
          acceleratorManifest,
        }),
      ).toEqual([]);
      expect(Object.keys(catalog.messages).sort()).toEqual(englishKeys);
      for (const key of englishKeys) {
        const reference = english.messages[key];
        const translated = catalog.messages[key];
        expect(reference).toBeDefined();
        expect(translated).toBeDefined();
        if (reference === undefined || translated === undefined) continue;
        expect(messageKind(translated), `${packageName}/${locale}:${key}`).toBe(messageKind(reference));
        expect(placeholders(translated), `${packageName}/${locale}:${key}`).toEqual(placeholders(reference));
      }
    }
  });

  test('rejects collisions inside every public accelerator scope', async () => {
    const english = await loadCatalog(packageName, 'en');
    const acceleratorManifest = await loadAcceleratorManifest(packageName);
    if (packageName === 'code-editor') {
      expect(acceleratorManifest.scopes).toEqual([]);
    } else {
      expect(acceleratorManifest.scopes.length).toBeGreaterThan(0);
    }
    for (const scope of acceleratorManifest.scopes) {
      expect(scope.keys.length, scope.name).toBeGreaterThan(1);
      const [first, second] = scope.keys;
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      if (first === undefined || second === undefined) continue;
      const colliding: Catalog = {
        ...english,
        messages: { ...english.messages, [first]: '~A~lpha', [second]: '~A~lternate' },
      };
      const issues = validateCatalog(colliding, {
        mode: 'strict',
        official: true,
        referenceCatalog: english,
        acceleratorManifest,
      });
      expect(
        issues.some(
          (issue) =>
            issue.code === 'INVALID_MESSAGE' &&
            issue.severity === 'error' &&
            issue.key === second &&
            issue.path.at(-1) === 'accelerator',
        ),
        scope.name,
      ).toBe(true);
    }
  });

  test('does not expose an eager locale registry or locale catalog data from the main entry', async () => {
    const main: Record<string, unknown> = await import(`@jsvision/${packageName}`);
    const { manifestPath } = await localeExport(packageName, 'en');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      readonly exports?: Readonly<Record<string, unknown>>;
    };
    expect(
      Object.keys(manifest.exports ?? {})
        .filter((key) => key.startsWith('./locales/'))
        .map((key) => key.slice('./locales/'.length))
        .sort(),
    ).toEqual([...LOCALES].sort());
    const catalogs = Object.values(main).filter(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        Reflect.get(value, 'schema') === 1 &&
        typeof Reflect.get(value, 'locale') === 'string',
    );
    expect(catalogs).toEqual([]);
    for (const value of Object.values(main)) {
      if (typeof value !== 'object' || value === null) continue;
      const nestedCatalogs = Object.values(value).filter(
        (nested) => typeof nested === 'object' && nested !== null && Reflect.get(nested, 'schema') === 1,
      );
      expect(nestedCatalogs.length).toBeLessThan(2);
    }
  });
});
