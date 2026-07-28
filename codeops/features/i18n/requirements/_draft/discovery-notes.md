# i18n Requirements Discovery Notes

> **Status:** Discovery complete; formal requirements authored
> **Next:** Validate requirements and create the implementation plan

## Vision

Create a first-party, JSVision-owned `@jsvision/i18n` package for both framework-owned
messages and application-owned translations. It must support Node terminal applications and
`@jsvision/web` browser applications.

## Confirmed stakeholders

- Application developers
- Translation/catalog maintainers
- Application end users
- JSVision package maintainers
- Plugin and agent users

## Confirmed release outcomes

- Existing applications retain byte-for-byte-compatible English behavior without configuration.
- Applications can provide their own translations.
- JSVision ships complete, maintained translations for:
  - English (`en`) as the default and final fallback
  - Dutch (`nl`)
  - German (`de`)
  - French (`fr`)
  - Spanish (`es`)
  - Italian (`it`)
  - European Portuguese (`pt-PT`)
  - Polish (`pl`)
  - Romanian (`ro`)
  - Swedish (`sv`)
- Node and browser runtimes behave consistently.
- Missing translations fall back safely.

## Translation quality policy

- Every official JSVision locale must cover 100% of framework-owned keys before release.
- Every official translation must have current digest-bound review evidence.
- Review evidence discloses whether the method was proficient-human or AI-assisted; AI review must
  never be represented as human proficiency.
- Official catalogs must have valid plural categories, valid non-conflicting accelerators, and
  layout acceptance coverage.
- Application catalogs may be partial by default.
- Missing application translations fall back to English or the call-site default message.
- Development reports missing application translations.
- Production fallback never exposes an internal translation key when a default message exists.
- Applications may opt into strict CI validation requiring complete catalog coverage.

## Locale policy

- Language-level catalogs are the default.
- Region variants are used when differences are material.
- European Portuguese starts as `pt-PT`.
- Applications may provide regional overrides such as `pt-BR`, `fr-CA`, or `de-CH`.

## Confirmed application lifecycle

- Catalogs and asynchronous sources are loaded before application construction.
- `createI18n(...)` creates a synchronously usable translator from in-memory catalogs.
- `loadI18n(...)` loads asynchronous sources and resolves to a synchronously usable translator.
- `createApplication()` remains synchronous and accepts a fully loaded `i18n` instance.
- Omitting the option supplies JSVision's built-in English translator.
- The returned application exposes the exact instance as `app.i18n`.
- Framework helpers passed the application as their host use `app.i18n` for framework-owned text.
- Application-owned views use the same instance explicitly.
- Standalone composite widgets accept an explicit `i18n` option.
- The design must not use a process-global mutable translator.
- The startup order is: load catalogs → create i18n → create application → construct views → run.

## Confirmed failure and edge-case policy

- No i18n configuration preserves English output; locale auto-detection is explicit opt-in.
- In-memory creation is synchronous; source-backed creation is awaited before app construction.
- Unsupported locales follow region → language → configured fallback → call-site default.
- Missing keys use the call-site default when present and otherwise return the key.
- Missing interpolation parameters remain visibly unresolved and emit a developer diagnostic without
  logging other parameter values; extra parameters are ignored.
- Invalid catalogs and invalid replacements are rejected atomically.
- Multiple sources load, validate, and merge completely before publication.
- Required source failures reject startup; optional source failures are reported and skipped.
- NUL, ESC, and terminal control sequences are rejected while normal Unicode and line breaks remain valid.
- Concurrent translation calls observe either the complete old catalog or complete new catalog.

## Codex plugin integration

- The canonical JSVision skill must teach agents when and how to use `@jsvision/i18n`.
- The skill must cover startup loading, application injection, app-owned messages, framework defaults,
  locale fallback, plural/select messages, accelerators, catalog validation, and Node/browser boundaries.
- A dedicated human-reviewed `references/i18n.md` guide must be routed from the canonical skill.
- `@jsvision/i18n` must be added to generated API-reference coverage.
- `tools/jsvision-plugin-impact.json` must map i18n source changes to the new guide, app-lifecycle
  guidance, relevant recipes, and generated API material.
- Executable i18n recipe snippets must be drift-checked against their source modules.
- `yarn plugin:update` must regenerate the distributed skill copy; that generated copy is never edited
  directly.
- `yarn plugin:check` and the full `yarn verify` gate must cover plugin correctness and drift.

## Confirmed catalog and user-facing API

- Catalogs are locale-scoped and carry an explicit schema version.
- TypeScript catalogs use `defineCatalog({ schema, locale, messages })`.
- JSON catalogs use the equivalent `{ schema, locale, messages }` representation.
- A message value is a plain interpolated string or a structured plural/select message.
- `plural(parameter, cases)` and `select(parameter, cases)` are TypeScript authoring helpers whose
  output matches the JSON representation.
- `other` is mandatory for every plural and select message.
- Translation uses `i18n.t(key, { params, defaultMessage })`.
- Call-site defaults may themselves be structured plural/select messages.
- Cardinal plural selection uses `Intl.PluralRules` for the locale of the resolved message.
- The plural controlling parameter must be a finite number.
- The plural category selects its matching case and falls back to mandatory `other`.
- The plural count is interpolated with `Intl.NumberFormat` for the same resolved locale.
- Negative numbers, zero, and decimals follow native `Intl.PluralRules`; JSVision does not invent rules.
- The service exposes locale-aligned `i18n.number(...)` and `i18n.date(...)` formatters.
- Missing/invalid plural parameters produce a safe developer diagnostic under the accepted failure policy.

## Confirmed package and UI integration

- `@jsvision/i18n` has zero runtime dependencies; `@jsvision/core` remains unchanged.
- UI, Forms, Files, and Datagrid depend directly on i18n and own their respective framework catalogs.
- Application catalog values override embedded framework values.
- Framework message keys are stable public API with breaking-change/deprecation discipline.
- UI re-exports essential i18n construction, authoring, and type APIs; Node loaders remain on the
  dedicated Node entry point.
- Omitting i18n preserves embedded English behavior.
- Application-hosted helpers use `app.i18n`; standalone composites accept optional explicit injection.
- Application views use explicit injection; there is no hidden/global context.

## Confirmed translated layout policy

- Localized dialogs retain current English minimums and grow to translated intrinsic content where needed.
- Dialogs clamp to the viewport and never render outside it.
- Button bands may wrap onto additional rows.
- Message bodies wrap vertically; one-line labels use display-cell-aware allocation and clip only as a
  last resort in undersized terminals.
- Every official locale must render without semantic clipping at 80×24.
- Below 80×24, controls remain operable through responsive layout, wrapping, scrolling, or documented
  clipping priority.
- Width measurement uses terminal display cells, not JavaScript string length.
- V1 guarantees left-to-right layout only.

## Confirmed accelerator policy

- Malformed or colliding official accelerators fail catalog/layout verification.
- A malformed application override falls back to the valid English framework label and reports a
  development diagnostic.
- Application-owned collisions warn by default and fail optional strict validation.
- If a collision reaches production, the existing first-claimant behavior remains deterministic while
  focus and mouse keep every control reachable.
- A translated label may omit its accelerator when no natural unique accelerator exists.
- V1 parses accelerators once because locale is fixed for the view-tree lifetime.

## Excluded external package

- `@jsvision/code-editor` is not available in this repository and is excluded from this feature.
- Its future adoption is tracked as a standalone GitHub issue, not as a requirement, task, or feature-plan
  entry for this work.
- No code-editor-specific catalog, key inventory, UI migration, compatibility promise, or acceptance claim
  is part of this feature.

## Confirmed coverage-audit decisions

- `@jsvision/forms` owns a default OK label and requires the same direct i18n integration and
  framework-catalog policy as UI, Files, and Datagrid.
- UI calendar and switch controls contain framework-owned English text, including month names,
  weekday labels, `Today`, `On`, and `Off`; all are framework-owned messages or locale data.
- An explicitly supplied `firstDayOfWeek` wins. Otherwise, an explicitly configured locale supplies
  the week convention; the no-configuration behavior remains Sunday-first.
- DatePicker retains ISO `YYYY-MM-DD` as its default in every locale. Applications opt into another
  input order with the existing explicit `format` option.
- Files uses locale-aligned date, time, and number formatting for metadata. Filenames, paths, and
  wildcard expressions remain untranslated data.
- Explicit i18n configuration supplies locale-aware string comparison to UI and Datagrid sorting,
  filtering, and value-list ordering. No configuration preserves current host-default comparison.
- Only user-visible framework wording is translatable. Developer diagnostics, internal command
  identifiers, enum discriminators, theme-role names, persisted identifiers, filenames, and paths
  remain stable non-translated values.
- Locale controls formatting conventions but never chooses a currency. Currency is explicit; time
  zone is explicit or defaults to the runtime time zone.
- An executable recipe proves application-owned translation integration. Fully translating the
  private Theme Designer is not required by v1.
- Catalog schema compatibility, layer collisions, custom-source cancellation, input hardening,
  diagnostics resilience, and runtime formatter caching still require detailed decisions.

## Selected domain lenses

| Lens | Evidence |
|---|---|
| Data and migration | Translation catalogs are serialized public artifacts whose schema, compatibility, validation, override order, and version evolution affect consumers across releases. |

Universal CodeOps ambiguity, security, compatibility, public API, quality, and verification
categories also apply.

## Open discovery areas

- Exact message/catalog syntax
- Public TypeScript API and type-safety level
- Locale selection and lifecycle
- JSVision integration and dependency boundaries
- Accelerator validation and translated layout behavior
- Diagnostics, fallback, and failure policy
- Catalog schema evolution and compatibility
- Tooling, extraction, and contributor workflow
- Explicit v1 exclusions

## Accepted comparable-system feature set

### Translation resolution

- BCP-47 locale canonicalization, including POSIX input cleanup
- Deterministic requested-region → language → configured-fallback → default-message fallback
- Call-site English default messages
- Namespaced keys
- Ordered catalog layering
- Missing-key diagnostics

### Message capabilities

- Named `${name}` interpolation
- Cardinal plurals backed by `Intl.PluralRules`
- Select variants for grammatical or state-dependent wording
- Locale-aligned number and date formatting
- Ordinal plurals are deferred for consideration after v1
- Nested messages are out of v1
- HTML and rich-text messages are out of scope

### Catalogs and tooling

- In-memory TypeScript catalogs
- JSON catalogs
- A secure Node-only JSON loader
- Custom asynchronous translation sources
- Catalog merging and validation APIs
- Key extraction and generated key types are deferred until after v1
- File watching and hot reload are out of v1

### JSVision integration

- One application-level owner through `createApplication({ i18n })`
- Explicit i18n injection for standalone composite widgets
- Complete catalogs for all ten shipped locales
- Accelerator validation
- Translated-layout acceptance tests
- Locale is fixed for the lifetime of a v1 application/view tree
- Runtime locale switching is deferred until after v1
- RTL/bidirectional layout is out of initial scope
