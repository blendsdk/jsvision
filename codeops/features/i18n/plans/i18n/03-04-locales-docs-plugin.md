# Component specification: locales, documentation, and plugin

## Locale entry points

Official locale tags are `en`, `nl`, `de`, `fr`, `es`, `it`, `pt-PT`, `pl`, `ro`, and `sv`.
Each of UI, Forms, Files, and Datagrid exports one catalog from explicit subpaths such as
`@jsvision/ui/locales/nl`. Main entry points import no non-English catalog.

A deterministic repository script owns the repeated locale entry files and package export-map
fragments. Generation is stable, checked in, and verified for:

- declaration and ESM resolution;
- one catalog per subpath with the declared canonical locale;
- absence of non-English catalog strings from a main-entry browser bundle;
- exact key/kind/placeholder parity with English.

## Translation review

The checked review manifest records, per package and non-English locale:

- normalized catalog SHA-256 digest;
- reviewer identity or stable reviewer reference;
- locale proficiency attestation;
- review date;
- approval status.

The verifier recomputes digests and rejects missing, stale, duplicate, or unapproved evidence.
Draft catalogs may exist before approval, but the release verification target remains red. Catalog
changes invalidate only their matching review entries.

## Documentation

The docs site adds an i18n guide covering:

- browser and Node installation/import boundaries;
- `createI18n`, `loadI18n`, catalog definition, plural/select, interpolation escaping, formatters,
  diagnostics, and atomic overrides;
- explicit `createApplication({ i18n })` injection;
- framework plus application catalog ordering;
- partial versus strict validation;
- a custom remote source with caller-owned abort/timeout;
- a runnable localized Theme Designer recipe;
- migration from no-config English and from BlendSDK concepts.

Generated API reference includes the new package and locale entry points. Package READMEs/changelogs
document compatibility and attribution.

## Codex plugin

The canonical `tools/jsvision-skill/` source gains:

- an i18n guide and API reference;
- decision guidance for when generated applications need localization;
- recipes that import only requested locale subpaths, create one service, add app catalogs last, and
  inject the service into `createApplication`;
- plural/select and custom-source examples;
- verification guidance for catalog validation, layout, and locale bundle isolation.

`tools/jsvision-plugin-impact.json` maps relevant i18n and application source paths to those
references. `yarn plugin:update` regenerates `plugins/jsvision-plugin/skills/jsvision/`; direct edits
to that copy are prohibited. `yarn plugin:check` and a generated-app recipe test prove the plugin can
produce a typechecking localized application without installing dependencies on its own.

## Compatibility and performance

- Main entry bundle has zero runtime dependencies and no Node built-ins.
- Warm `t()` performs no template compilation or formatter construction.
- The accepted benchmark records median and p95 against a fixed catalog/call workload with a
  documented environment and regression threshold.
- No-config snapshots remain byte-identical for all migrated components.
