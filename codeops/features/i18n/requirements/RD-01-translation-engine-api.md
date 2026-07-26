# RD-01: Translation Engine and Public API

> **Document**: RD-01-translation-engine-api.md
> **Status**: Draft
> **Created**: 2026-07-25
> **Project**: jsvision (`@jsvision/i18n`)
> **Depends On**: —
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Create the browser-safe, zero-runtime-dependency translation engine that every JSVision package and
application can share. The engine is a substantial hardening port of BlendSDK's MIT-licensed
translator: it retains named interpolation, locale fallback, ordered catalogs, source abstraction,
and atomic replacement while replacing two-form plural tuples with `Intl.PluralRules`, adding
select messages and call-site defaults, and validating every public input. *(AR #1, AR #6, AR #14,
AR #15, AR #18, AR #23, AR #29)*

## Functional Requirements

### Must Have

- [ ] **FR-1 — Package and entry point.** Publish `@jsvision/i18n` as ESM for Node 22+ and modern
      browsers with no runtime dependencies and no `node:*` import reachable from the main entry.
      The package manifest exposes `.` and `./node`; RD-02 owns the latter. *(AR #1, AR #9, AR #22)*
- [ ] **FR-2 — Catalog schema.** `defineCatalog()` accepts exactly
      `{ schema: 1, locale, messages }`. Unknown/missing top-level fields, schema values other than
      `1`, invalid locale declarations, invalid keys, invalid messages, and duplicate logical keys
      produce structured validation issues and no usable catalog. *(AR #6, AR #14, AR #17)*
- [ ] **FR-3 — Message model.** A message is either a string or:
      `{ kind: 'plural'|'select', parameter: string, cases: { ...stringCases, other: string } }`.
      Cases never contain another structured message. `plural(parameter, cases)` and
      `select(parameter, cases)` produce the exact JSON representation. *(AR #6, AR #7, AR #23)*
- [ ] **FR-4 — Service construction.** `createI18n(options?)` synchronously creates a usable
      `I18n` service. `locale` defaults to `en`; `locale: 'auto'` is the only automatic detection
      mode. `fallbackLocales` defaults to `['en']`, and `en` remains an implicit final catalog
      fallback even if callers omit or reorder it. *(AR #2, AR #4, AR #5, AR #19)*
- [ ] **FR-5 — Translation.** `t(key, { params?, defaultMessage? }?)` resolves:
      requested region → requested language → each configured fallback region/language → `en` →
      `defaultMessage` → key. For each locale, layers are searched newest to oldest before moving to
      the next locale. The selected plural rule and numeric interpolation use the resolved message
      locale; a call-site default is English. *(AR #2, AR #5, AR #15)*
- [ ] **FR-6 — Interpolation.** `${name}` substitutes only own parameters whose names match the
      parameter grammar. `$${name}` emits literal `${name}`. Missing values leave `${name}` visible
      and record a diagnostic; extra values are ignored. Only strings, finite numbers, booleans, and
      bigints are accepted. Arbitrary object coercion never runs. *(AR #5, AR #17, AR #23)*
- [ ] **FR-7 — Plural behavior.** Cardinal categories come from `Intl.PluralRules` for the resolved
      message locale. `other` is mandatory; an absent selected category uses `other`. The controlling
      parameter must be a finite number. Zero, negatives, and decimals follow `Intl`; invalid/missing
      controllers diagnose, use `other`, and keep unresolved interpolation visible. *(AR #6, AR #23)*
- [ ] **FR-8 — Select behavior.** Select controllers accept string, finite number, boolean, or bigint,
      use exact stringified case matching, and otherwise use mandatory `other`. Missing/invalid
      controllers record a diagnostic and use `other`. *(AR #6, AR #23)*
- [ ] **FR-9 — Formatting and comparison.** The service exposes `number(value, options?)`,
      `date(value, options?)`, and `compare(left, right, options?)`. Number accepts finite number or
      bigint; currency formatting requires an explicit ISO 4217 currency. Date accepts a valid
      `Date` or finite epoch milliseconds; invalid formatter input throws a typed programmer error.
      Locale-aware framework search uses NFC plus locale casing. *(AR #9, AR #20)*
- [ ] **FR-10 — Atomic runtime overlay.** `setCatalog(catalog)` validates and copy-on-write replaces
      the highest-priority runtime overlay for that catalog's locale. A failed replacement throws and
      leaves the old snapshot active. Concurrent synchronous translations observe either the complete
      old snapshot or the complete new snapshot. *(AR #5, AR #15)*
- [ ] **FR-11 — Introspection.** Public readonly state includes canonical `locale`,
      `fallbackLocales`, sorted `availableLocales`, bounded diagnostics, and
      `has(key, locale?)`. `validateCatalog()` and `validateCatalogs()` return structured issues.
      Internal layers, compiled templates, and caches are not exposed. *(AR #18, AR #21)*
- [ ] **FR-12 — Diagnostics.** Recoverable faults record a stable code, severity, key, locale, and
      optional source identifier without parameter values or translated text. Diagnostics are
      deduplicated and bounded to 100 records. An optional sink receives new records; sink exceptions
      are swallowed. The engine never writes directly to stdout/stderr. *(AR #5, AR #18)*

### Should Have

- [ ] **FR-13 — Explicit validation modes.** `validateCatalogs()` supports partial application mode
      and strict completeness mode against a supplied reference-key set and placeholder manifest.
      *(AR #3, AR #10, AR #21)*

### Won't Have (Out of Scope)

- Runtime locale mutation or per-view locale context.
- Ordinal plurals, nested structured messages, rich text, HTML, message functions, or arbitrary code.
- Generated key unions, extraction, proxy objects, or nested message-key access.
- Process-global translator or catalog registry.

## Technical Requirements

### T-1 Public TypeScript surface

```typescript
export type Message = string | PluralMessage | SelectMessage;
export type MessageParams = Readonly<Record<string, string | number | boolean | bigint>>;

export interface Catalog {
  readonly schema: 1;
  readonly locale: string;
  readonly messages: Readonly<Record<string, Message>>;
}

export interface I18n {
  readonly locale: string;
  readonly fallbackLocales: readonly string[];
  readonly availableLocales: readonly string[];
  readonly diagnostics: readonly I18nDiagnostic[];

  t(key: string, options?: TranslateOptions): string;
  number(value: number | bigint, options?: Intl.NumberFormatOptions): string;
  date(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  compare(left: string, right: string, options?: Intl.CollatorOptions): number;
  has(key: string, locale?: string): boolean;
  setCatalog(catalog: CatalogInput): void;
}
```

All exported types, values, methods, options, properties, and error codes receive JSDoc suitable
for a first-time SDK consumer, including practical examples. *(AR #6, AR #18, AR #21)*

### T-2 Grammar and canonicalization

| Input | Grammar / behavior |
|---|---|
| Message key | `^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$`; maximum 512 Unicode scalar values |
| Parameter | `^[A-Za-z][A-Za-z0-9_]*$` |
| Catalog locale | Canonical BCP-47 without Unicode/private-use extensions |
| Explicit requested locale | POSIX cleanup, then `Intl.getCanonicalLocales`; extensions preserved for formatting and stripped for catalog lookup |
| `C` / `POSIX` | Canonical requested locale `en` |
| Invalid explicit locale | Throw `I18nError` with `INVALID_LOCALE` |

### T-3 Internal representation

Validated catalogs are deep-copied into `Map`-backed immutable snapshots. Templates and placeholder
sets compile during publication, not translation. The service holds one atomic snapshot reference.
Every per-call parameter lookup uses own-property semantics. *(AR #15, AR #17, AR #20)*

### T-4 Formatter caching

Each service owns separate 64-entry LRU caches for `Intl.PluralRules`, `NumberFormat`,
`DateTimeFormat`, and `Collator`, keyed by canonical locale plus a stable serialization of copied,
allowlisted options. Repeated warm calls do not create a new formatter or parse a template.
*(AR #20, AR #26)*

### T-5 Error taxonomy

At minimum, typed errors/issues distinguish:

`INVALID_LOCALE`, `UNSUPPORTED_SCHEMA`, `INVALID_CATALOG`, `INVALID_KEY`, `INVALID_MESSAGE`,
`INVALID_PARAMETER`, `MISSING_TRANSLATION`, `MISSING_PARAMETER`, `INVALID_CONTROLLER`,
`UNSAFE_TEXT`, and `CATALOG_LIMIT_EXCEEDED`.

Configuration/loading/validation errors throw `I18nError`; recoverable runtime lookup faults use
diagnostics and fallback. *(AR #5, AR #17, AR #18)*

## Integration Points

- RD-02 supplies validated catalogs and async source construction.
- RD-03 passes the exact service through `Application` and package composites.
- RD-04 verifies browser packaging, performance, compatibility, catalogs, and plugin examples.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Port shape | Dependency / literal copy / hardened owned port | Hardened owned port | Preserve proven concepts while meeting JSVision safety and plural requirements | AR #29 |
| Messages | Strings / ICU parser / one-level discriminated structures | One-level structures | JSON parity without parser/runtime complexity | AR #6, AR #23 |
| Fallback | Key-first / layer-first / locale-first | Locale-first, then layer | Prevent English overrides suppressing localized framework text | AR #5, AR #15 |
| Replacement | Immutable only / mutable registry / copy-on-write overlay | Copy-on-write overlay | Retains accepted atomic `setCatalog()` behavior | AR #15 |
| Diagnostics | Console / throw / bounded structured state | Bounded structured state | Safe in owned terminals and browsers | AR #18 |

## Security Considerations

- **Data sensitivity:** Catalogs and keys must not contain secrets; diagnostics never capture values.
- **Input validation:** Every locale, key, message, parameter, formatter option, and replacement is
  allowlisted and copied before use.
- **Authentication/authorization:** Not applicable to this local library.
- **Injection:** Catalog and parameter text rejects terminal controls and bidi overrides per RD-02.
- **Encryption/rate limiting/infrastructure:** Not applicable; custom-source transport belongs to callers.
- **Code execution:** Message evaluation never invokes functions or object coercion.

## Acceptance Criteria

1. [ ] Importing `@jsvision/i18n` in a browser-target build resolves no `node:*` module and package
       installation adds zero runtime dependencies.
2. [ ] `t()` passes a table covering exact region, base language, multiple configured fallbacks,
       mandatory English, structured default message, and final key behavior with locale-first/layer-last ordering.
3. [ ] Polish plural tests produce `one` for 1, `few` for 2 and 22, `many` for 5 and 12, and
       `other` for 1.5 using `Intl.PluralRules('pl')`.
4. [ ] Missing/unsafe parameters never expose a control character, never execute object coercion,
       keep the placeholder visible, and create a value-free diagnostic.
5. [ ] A rejected `setCatalog()` leaves every prior translation byte-identical; a valid replacement
       becomes wholly visible on the next call.
6. [ ] Repeating a warm translation 100,000 times creates no new compiled template or `Intl`
       formatter and meets RD-04's benchmark gate.
7. [ ] Every public export passes the repository JSDoc check.
