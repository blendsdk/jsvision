# @jsvision/i18n

First-party internationalization for JSVision applications and packages. The package provides
typed catalogs, locale fallback, interpolation, cardinal plurals, selects, locale-aware formatting,
catalog validation, atomic runtime overlays, and bounded diagnostics.

The default entry point is ESM-only, browser-safe, has zero runtime dependencies, and supports
Node.js 22 or newer.

```bash
npm install @jsvision/i18n
```

## Create a catalog

Catalogs use namespaced keys and canonical BCP-47 locale tags. `defineCatalog` validates, copies,
and freezes the input before returning it.

```ts
import { defineCatalog, plural, select } from '@jsvision/i18n';

const nl = defineCatalog({
  schema: 1,
  locale: 'nl',
  messages: {
    'app.greeting': 'Hallo ${name}',
    'files.count': plural('count', {
      one: '${count} bestand',
      other: '${count} bestanden',
    }),
    'account.status': select('status', {
      active: 'Actief',
      other: 'Onbekend',
    }),
  },
});
```

Structured messages are intentionally shallow: each plural or select case is a string. The
`other` case is always required. Plural selection uses `Intl.PluralRules` with cardinal rules for
the locale of the resolved message, so applications provide the categories used by that locale
rather than implementing their own singular/plural branching.

## Translate and format

English is the default locale and the final implicit fallback. Later catalogs for the same locale
have higher priority.

```ts
import { createI18n } from '@jsvision/i18n';

const i18n = createI18n({
  locale: 'nl-NL',
  fallbackLocales: ['de'],
  catalogs: [nl],
});

i18n.t('app.greeting', { params: { name: 'Ada' } });
i18n.t('files.count', { params: { count: 2 } });
i18n.t('dialog.cancel', { defaultMessage: 'Cancel' });

i18n.number(12345.67);
i18n.date(new Date('2026-07-25T12:00:00Z'));
i18n.compare('appel', 'peer');
```

Lookup tries the requested region, its base language, configured fallbacks, and finally English.
If no catalog contains a key, `t` evaluates the English `defaultMessage` when supplied and
otherwise returns the key. Missing translations, parameters, and controllers produce value-free
diagnostics instead of interrupting rendering.

Locale auto-detection is opt-in:

```ts
const i18n = createI18n({ locale: 'auto', catalogs: [nl] });
```

Use an explicit locale for deterministic applications and tests.

## Application translations and runtime overlays

Applications can layer their translations after framework catalogs. A later layer overrides only
the keys it supplies:

```ts
const i18n = createI18n({
  locale: 'nl',
  catalogs: [frameworkEnglish, frameworkDutch, applicationDutch],
});
```

Use `setCatalog` to replace the highest-priority runtime overlay for one locale. Publication is
atomic: an invalid replacement throws without changing the active translations.

```ts
i18n.setCatalog({
  schema: 1,
  locale: 'nl',
  messages: {
    'app.greeting': 'Welkom ${name}',
  },
});
```

## Validate catalogs

`validateCatalog` returns immutable, stably ordered issues. Partial validation is suitable for
application overlays. Strict validation can compare official catalogs with a reference catalog,
placeholder manifest, and accelerator scopes.

```ts
import { formatCatalogIssue, validateCatalog } from '@jsvision/i18n';

const issues = validateCatalog(candidate, {
  mode: 'strict',
  referenceCatalog: english,
  placeholderManifest: {
    'files.count': ['count'],
  },
  acceleratorManifest: {
    scopes: [{ name: 'file-menu', keys: ['menu.open', 'menu.close'] }],
  },
  official: true,
});

for (const issue of issues) {
  console.error(formatCatalogIssue(issue));
}
```

Accelerators use JSVision's tilde markup: `~O~pen` marks `O`, while `~~` renders one literal tilde.
Strict validation requires a unique ASCII accelerator for each key listed in a scope's
`requiredKeys`. When `requiredKeys` is omitted, every key in that co-visible scope is required. A
translated label may remain unaccelerated by keeping it in `keys` for collision topology while
omitting it from `requiredKeys`.

`defineCatalog` is the throwing boundary for one catalog. `mergeCatalogs` validates and combines
ordered catalogs, with later values winning for duplicate locale/key pairs.

## Diagnostics and errors

Recoverable translation faults are deduplicated and retained in `i18n.diagnostics`, up to 100
records. A sink can observe each new record:

```ts
const i18n = createI18n({
  diagnosticSink(diagnostic) {
    logger.warn(diagnostic);
  },
});
```

Diagnostics contain identities such as code, key, locale, and source; they never contain
translated text or parameter values. Configuration, validation, and formatter misuse throw
`I18nError`, which can be recognized with `isI18nError`.

## Compatibility

- ESM only.
- Node.js 22 or newer.
- Browser-safe default export with no `node:*` imports.
- Zero runtime dependencies.
- Uses built-in `Intl` implementations for locale canonicalization, formatting, collation, and
  cardinal plural rules.

See the [JSVision repository](https://github.com/blendsdk/jsvision) and
[documentation site](https://blendsdk.github.io/jsvision/) for the full SDK documentation.
