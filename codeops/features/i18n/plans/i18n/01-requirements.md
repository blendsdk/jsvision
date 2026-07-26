# Requirements boundary

The authoritative behavior is defined by:

- [RD-01 — Translation engine and public API](../../requirements/RD-01-translation-engine-api.md)
- [RD-02 — Catalog sources and validation](../../requirements/RD-02-catalog-sources-validation.md)
- [RD-03 — Framework and application integration](../../requirements/RD-03-framework-application-integration.md)
- [RD-04 — Quality, documentation, locales, and plugin](../../requirements/RD-04-quality-docs-plugin.md)

## Planning deltas

No product requirement is changed by this plan. The implementation-only decisions are recorded as
AR-30 through AR-45 in [00-ambiguity-register.md](00-ambiguity-register.md).

The implementation boundary deliberately excludes:

- `@jsvision/code-editor`; its future integration is tracked only in
  [GitHub issue #184](https://github.com/blendsdk/jsvision/issues/184).
- runtime locale mutation, global registries, all-locale aggregate entry points, ordinal/nested/rich
  messages, extraction/type generation, built-in networking, and file watching.
- Theme Designer product localization; it receives a runnable localization recipe instead.

## Completion rule

All four RDs form one planning group because their acceptance is cross-package. A technically green
implementation is not release-complete while the translation-review evidence gate is open.
