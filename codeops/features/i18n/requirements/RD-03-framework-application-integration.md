# RD-03: Framework and Application Integration

> **Document**: RD-03-framework-application-integration.md
> **Status**: Draft
> **Created**: 2026-07-25
> **Project**: jsvision (`@jsvision/ui`, `@jsvision/forms`, `@jsvision/files`, `@jsvision/datagrid`)
> **Depends On**: RD-01, RD-02
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Connect one application-owned translation service to JSVision without a hidden context or global
registry. Migrate framework-owned English literals behind stable message keys while retaining every
existing explicit label option and exact no-configuration output. Package-owned locale subpaths let
applications import only the framework catalogs they actually use. *(AR #4, AR #8–AR #13, AR #22,
AR #24)*

## Functional Requirements

### Must Have

- [ ] **FR-1 — Application option.** `ApplicationOptions` gains `i18n?: I18n`.
      `createApplication()` remains synchronous. Omission creates the built-in English service;
      supplying a service stores that exact object, and every returned `Application` exposes it as
      readonly `app.i18n`. No locale detection occurs on omission. *(AR #2, AR #4, AR #5)*
- [ ] **FR-2 — Hosted helpers.** Framework helpers receiving an application/host use `host.i18n`.
      The relevant host interfaces gain readonly `i18n`; internal host adapters forward it.
      Application-owned views receive the same service explicitly. *(AR #4, AR #8)*
- [ ] **FR-3 — Standalone composites.** Composite widgets that mint framework text accept
      `i18n?: I18n`; omission preserves their embedded English behavior. Primitive widgets whose
      labels are supplied by callers remain string-based and do not acquire hidden translation.
      Explicit caller label/title/text options always win. *(AR #4, AR #8, AR #24)*
- [ ] **FR-4 — Direct dependencies.** UI, Forms, Files, and Datagrid declare direct
      `@jsvision/i18n` dependencies. Core remains unchanged. UI re-exports `createI18n`,
      `defineCatalog`, `plural`, `select`, `I18n`, `Catalog`, and common types from its main entry,
      but never re-exports Node loader APIs. *(AR #8, AR #22)*
- [ ] **FR-5 — Catalog subpaths.** Each owning package publishes one browser-safe subpath per
      official locale, e.g. `@jsvision/files/i18n/de`, exporting a named `catalog`. Main package
      imports do not load non-English catalogs. Package catalogs are passed before application
      catalogs so application values win. *(AR #2, AR #15, AR #22)*
- [ ] **FR-6 — Stable keys.** Framework keys use package prefixes (`ui.`, `forms.`, `files.`,
      `datagrid.`), dotted lowercase segments, and stable public API governance. Key rename/removal
      requires normal SemVer deprecation/breaking-change treatment. *(AR #8, AR #24, AR #28)*
- [ ] **FR-7 — Complete string inventory.** A checked manifest classifies every built-in literal
      candidate in the four packages as framework-translatable, caller-owned, developer-only, or
      stable internal data. New unclassified user-facing literals fail validation. *(AR #8, AR #24,
      AR #26)*
- [ ] **FR-8 — Translation boundary.** Translate built-in dialog/button/menu/filter/personalization
      text, `Today`, month/weekday names, `On`/`Off`, Forms OK, Files labels/errors/metadata units,
      Datagrid labels, and default boolean `Yes`/`No`. Do not translate developer diagnostics,
      command IDs, enum values, theme roles, persisted identifiers, source/file contents, filenames,
      paths, wildcards, language IDs, or caller-provided validation text. *(AR #8, AR #9, AR #24)*
- [ ] **FR-9 — Calendar conventions.** Explicit `firstDayOfWeek` wins. Otherwise, an explicitly
      supplied i18n service selects the package-reviewed official locale convention; unknown
      application locales use safe `Intl.Locale.weekInfo`/equivalent feature detection and fall back
      to Sunday. No-i18n behavior remains Sunday-first. DatePicker input remains ISO
      `YYYY-MM-DD` unless its existing explicit `format` option says otherwise. *(AR #9)*
- [ ] **FR-10 — Metadata and formatting.** Files metadata uses service date/time/number formatting.
      Locale never selects currency. An explicit time zone wins; omission uses the runtime zone.
      Filenames and paths remain byte-for-byte application/file-system data. *(AR #9)*
- [ ] **FR-11 — Collation and search.** When i18n is explicitly configured, UI and Datagrid default
      ordering/equality use `i18n.compare`, and built-in contains/prefix/suffix filters use NFC plus
      locale casing. Existing custom comparators/formatters win. No-configuration behavior preserves
      current host-default comparison. *(AR #9, AR #20)*
- [ ] **FR-12 — Accelerator manifests.** Each package declares accelerator-bearing keys and
      co-occurrence scopes. V1 official accelerators contain zero or one `~X~` pair where `X` is an
      ASCII letter; `~~` represents a literal tilde. Official malformed/colliding scopes fail.
      Application overrides warn normally or fail strict validation; a malformed framework-label
      override is ignored for that key and the valid English default is used. *(AR #10)*
- [ ] **FR-13 — Localized geometry.** Every localized width, truncation, padding, and pointer hit
      zone uses terminal display cells rather than `.length`. Dialogs retain current English minimums,
      grow to translated intrinsic content, clamp to the viewport, wrap body/button bands, and keep
      controls operable below 80×24. *(AR #9, AR #10)*

### Should Have

- [ ] **FR-14 — Package validation exports.** Each framework package exports a development/CI
      validator that combines its English reference, official/app catalogs, inventory, placeholder
      manifest, accelerator scopes, and layout cases. *(AR #3, AR #10, AR #21)*

### Won't Have (Out of Scope)

- Full Theme Designer translation; the executable recipe in RD-04 is the application-owned proof.
- `@jsvision/code-editor`; only GitHub issue #184 tracks that future package.
- Global component context, process-global locale, runtime locale switching, or RTL mirroring.
- Translation of caller-owned values, data, validation messages, file content, identifiers, or source code.

## Technical Requirements

### T-1 Application startup example

```typescript
import { createApplication, createI18n } from '@jsvision/ui';
import { catalog as uiNl } from '@jsvision/ui/i18n/nl';
import { catalog as filesNl } from '@jsvision/files/i18n/nl';
import { catalog as appNl } from './i18n/nl.js';

const i18n = createI18n({
  locale: 'nl',
  catalogs: [uiNl, filesNl, appNl],
});

const app = createApplication({ i18n });
```

Async applications await RD-02 `loadI18n()` before calling `createApplication()`. *(AR #4, AR #22)*

### T-2 Package-owned lookup

Framework call sites always include their exact existing English value:

```typescript
i18n.t('files.dialog.open.confirm', { defaultMessage: '~O~pen' });
```

This makes English no-configuration output independent of catalog loading and prevents keys from
surfacing in released UI. Official non-English catalogs are explicit imports, while application
catalogs may override the same stable key. *(AR #3, AR #5, AR #22, AR #24)*

### T-3 Inventory classes

| Class | Example | Treatment |
|---|---|---|
| Framework user-facing | Default `Cancel`, `Today`, filter operator | Stable key + English default |
| Caller-owned | Dialog title/text option, column title, validation message | Caller passes already translated value |
| Locale data | Official months/weekdays/week start | Reviewed locale catalog/data |
| Developer-only | Warning text, thrown programmer error | Stable developer English |
| Internal identifier | Command, enum discriminator, theme role | Never translated |
| External data | Filename, path, cell value, source text | Never translated automatically |

### T-4 Layout verification targets

Every composite containing built-in text has golden/layout scenarios for all ten official locales at
80×24 and representative smaller viewports. Semantic clipping means loss of the only visible action,
distinguishing word, value, or accelerator; it is forbidden at 80×24. Below that size, tests assert
focus/keyboard/mouse reachability even where documented cosmetic clipping remains. *(AR #9, AR #10)*

## Integration Points

- RD-01 supplies the shared service and formatting/comparison behavior.
- RD-02 supplies package/app catalog validation.
- RD-04 owns complete translations, method-disclosed review evidence, docs/plugin recipes, and the
  full matrix.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Ownership propagation | Global / derived resolver / exact injected service | Exact injected service | Explicit lifecycle and standalone support | AR #4 |
| Package catalogs | Global registry / central bundle / explicit subpaths | Explicit subpaths | Deterministic and tree-shakable | AR #22 |
| Date input | Locale-derived / stable ISO plus explicit override | Stable ISO | Avoid ambiguous behavioral changes | AR #9 |
| Week start | Always Sunday / ambient host / explicit then locale data | Explicit then locale data | Predictable official output and app control | AR #9 |
| Literal migration | Hand-picked / complete classified inventory | Complete inventory | Prevent hidden untranslated framework strings | AR #24 |

## Security Considerations

- Framework translation never applies to external data or identifiers, preventing semantic corruption.
- Catalog/parameter validation from RD-01/RD-02 protects terminal output from control injection.
- Malformed accelerator overrides fail safely without making controls unreachable.
- No application data, filenames, validation values, or diagnostics are copied into i18n diagnostics.
- There are no authentication, network, persistence, or encryption responsibilities in this RD.

## Acceptance Criteria

1. [ ] `createApplication()` without arguments produces the existing English golden screens and
       exposes an English `app.i18n`; supplying a service preserves object identity with `===`.
2. [ ] A Dutch application importing UI and Files Dutch subpaths renders both packages in Dutch,
       applies an application override last, and does not include German/French catalog modules in
       its browser dependency graph.
3. [ ] Every classified framework-owned string resolves through a stable package-prefixed key while
       explicit caller labels remain unchanged and take precedence.
4. [ ] Calendar weekday/month/Today text and week start are correct for all ten official locales;
       DatePicker still displays `YYYY-MM-DD` when `format` is omitted.
5. [ ] Files formats the same timestamp/size according to `en`, `nl`, and `de` while preserving the
       exact filename and path string.
6. [ ] UI/Datagrid locale ordering and built-in search differ appropriately for a tested accented
       locale only when i18n is explicit; no-config host-default tests remain unchanged.
7. [ ] All official accelerator scopes are collision-free; malformed app overrides fall back only
       for the affected label and every control remains keyboard/focus/mouse reachable.
8. [ ] All localized composites have no semantic clipping at 80×24 and use display-cell geometry for
       hit testing.
