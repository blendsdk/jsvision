import { createI18n, defineCatalog } from '@jsvision/i18n';
import type { Catalog, I18n } from '@jsvision/i18n';
import type { OfficialI18nLocale } from './types.js';

/** Official locales shared by UI, Forms, Files, Datagrid, and Code Editor. */
export const OFFICIAL_I18N_LOCALES = Object.freeze([
  'en',
  'nl',
  'de',
  'fr',
  'es',
  'it',
  'pt-PT',
  'pl',
  'ro',
  'sv',
] as const satisfies readonly OfficialI18nLocale[]);

/** Package locale subpaths composed into every fresh demo service. */
const FRAMEWORK_PACKAGES = Object.freeze(['ui', 'forms', 'files', 'datagrid', 'code-editor'] as const);

/** Whether an unknown value is one of the ten shipped locale identifiers. */
export function isOfficialI18nLocale(value: unknown): value is OfficialI18nLocale {
  return typeof value === 'string' && OFFICIAL_I18N_LOCALES.some((locale) => locale === value);
}

/**
 * Load and validate the single catalog exported by a framework locale module.
 *
 * Dynamic package subpaths keep the five-by-ten module matrix in one allowlisted loader. The
 * imported value still crosses `defineCatalog`, so a malformed build artifact cannot enter the
 * service merely because it came from a trusted package name.
 */
async function loadPackageCatalog(
  packageName: (typeof FRAMEWORK_PACKAGES)[number],
  locale: OfficialI18nLocale,
): Promise<Catalog> {
  const module: Record<string, unknown> = await import(`@jsvision/${packageName}/locales/${locale}`);
  const values = Object.values(module);
  if (values.length !== 1) {
    throw new TypeError(`Expected exactly one catalog export from @jsvision/${packageName}/locales/${locale}.`);
  }
  return defineCatalog(values[0]);
}

/** Load a fresh five-element catalog array after enforcing the runtime locale allowlist. */
export async function loadFrameworkCatalogs(locale: string): Promise<readonly Catalog[]> {
  if (!isOfficialI18nLocale(locale)) throw new RangeError('The requested locale is not supported.');
  return Promise.all(FRAMEWORK_PACKAGES.map((packageName) => loadPackageCatalog(packageName, locale)));
}

/**
 * Compose a fresh service from the five official catalogs and an optional application overlay.
 *
 * The overlay uses the selected locale and is validated through the normal public catalog boundary.
 * It is intentionally excluded from the returned framework catalog list.
 */
export async function createFrameworkI18n(
  locale: OfficialI18nLocale,
  applicationMessages?: Readonly<Record<string, string>>,
): Promise<{ readonly catalogs: readonly Catalog[]; readonly i18n: I18n }> {
  const catalogs = await loadFrameworkCatalogs(locale);
  const overlay =
    applicationMessages === undefined
      ? []
      : [
          defineCatalog({
            schema: 1,
            locale,
            messages: applicationMessages,
          }),
        ];
  return {
    catalogs,
    i18n: createI18n({ locale, catalogs: [...catalogs, ...overlay] }),
  };
}
