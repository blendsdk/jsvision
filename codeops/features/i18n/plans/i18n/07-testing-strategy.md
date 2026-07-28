# Testing Strategy: JSVision i18n

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing overview

| Code type | Target |
|---|---|
| Engine, parser, validation, security boundaries | 95% branches |
| Sources, locale generation, framework integration | 90% branches |
| Documentation, plugin recipes, package metadata | Executable validation of every example/artifact |

Tests use real `Intl`, real temporary files, real package builds, and real application objects.
Mocks are limited to source callbacks, diagnostic sinks, formatter constructors for allocation
counting, and platform race seams that cannot be triggered deterministically.

## 🚨 Specification Test Cases

These cases are derived only from the approved RDs and component specifications. Their expectations
are immutable: implementation failures are fixed in implementation, not by changing the oracle.

### Engine and catalog

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-01 | Import main entry in a browser-target build | Build succeeds with no `node:*` edge and package has no runtime dependency | RD-01 FR-1 |
| ST-02 | Define `{schema:1,locale:'nl-NL',messages:{'app.hello':'Hallo'}}` | Immutable usable catalog declares canonical `nl-NL` | RD-01 FR-2 |
| ST-03 | Define catalogs with schema 2, extra field, invalid key, nested message, or missing `other` | Each yields its stable structured issue and no usable catalog | RD-01 FR-2/3 |
| ST-04 | `createI18n()` then `t('missing.key')` | Locale is `en`, fallbacks are `['en']`, result is `missing.key` | RD-01 FR-4/5 |
| ST-05 | Requested `nl-BE`; layers contain app English override and framework Dutch base | Dutch base wins before English override; newest layer wins within one locale | RD-01 FR-5 |
| ST-06 | Missing catalog key with string/structured English `defaultMessage` | Default resolves in English; absent default returns key | RD-01 FR-5 |
| ST-07 | Message `Hi ${name}; $${name}` with own `name:'Ada'` | Result is `Hi Ada; ${name}` | RD-01 FR-6 |
| ST-08 | Missing parameter, inherited parameter, unsafe string, and object value | Placeholder remains; no coercion executes; value-free diagnostic is recorded | RD-01 FR-6/12 |
| ST-09 | Polish plural values 1, 2, 22, 5, 12, 1.5 | Categories resolve to one, few, few, many, many, other | RD-01 AC-3 |
| ST-10 | Plural controller absent, non-finite, or wrong primitive | `other` renders, unresolved placeholder stays visible, diagnostic records | RD-01 FR-7 |
| ST-11 | Select cases for string, number, boolean, bigint plus absent case | Exact string case wins; absent case uses `other` | RD-01 FR-8 |
| ST-12 | Number/bigint, valid date/epoch, and NFC strings passed to formatters | Output matches native Intl for service locale; comparison uses NFC | RD-01 FR-9 |
| ST-13 | NaN/infinite number, invalid Date, currency without code, invalid locale | Typed stable `I18nError` is thrown without native coercion | RD-01 FR-9/T-5 |
| ST-14 | Valid overlay replacement then invalid replacement | Valid swap is wholly visible; rejected swap leaves prior bytes unchanged | RD-01 FR-10 |
| ST-15 | Generate 120 identical and distinct recoverable faults; sink throws | Diagnostics deduplicate, retain at most 100, contain no values/text, and translation continues | RD-01 FR-12 |
| ST-16 | Repeat warmed plural/format translation 100,000 times | No new template compilation or Intl construction occurs | RD-01 AC-6 |

### Sources and security

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-17 | Three async sources complete out of order with colliding keys | Declared source order determines later-wins result | RD-02 FR-1–3 |
| ST-18 | Optional source rejects and required source succeeds | Service publishes successful catalogs plus one sanitized diagnostic | RD-02 FR-3 |
| ST-19 | Required source rejects or shared signal aborts | Promise rejects with source error or `ABORTED`; no service publishes | RD-02 FR-3 |
| ST-20 | Custom source inspects context | Every source receives the same concrete signal; library creates no timeout/network call | RD-02 FR-2/4 |
| ST-21 | Literal rooted paths and immediate `locales/*.json` | Literals keep declaration order; glob files sort lexicographically | RD-02 FR-5/6 |
| ST-22 | Missing literal and empty immediate glob | Missing literal rejects; empty glob returns no catalog | RD-02 FR-6 |
| ST-23 | Absolute, `..`, sibling-prefix, recursive glob, wildcard, wrong suffix | Loader rejects before reading outside the root | RD-02 FR-5/6 |
| ST-24 | File symlink, nested directory symlink, directory, and supported FIFO target | Escape/non-regular targets reject | RD-02 T-2 |
| ST-25 | Candidate is replaced between check and read through test seam | Loader rejects inconsistent identity or safely reads the checked opened handle | RD-02 T-2 |
| ST-26 | JSON has duplicate members at top/nested level, comments, trailing data, malformed number/string | Strict parser rejects every document | RD-02 FR-7 |
| ST-27 | BOM/ill-formed UTF-8, lone surrogate, NUL/C0/C1/DEL/bidi controls | Decode or catalog validation rejects atomically | RD-02 FR-7/9 |
| ST-28 | File/message/key/count at limit and one unit over | At-limit input succeeds; over-limit input yields `CATALOG_LIMIT_EXCEEDED` | RD-02 FR-8 |
| ST-29 | Strict validation against English/placeholder/accelerator manifests | Missing/extra/kind/placeholder/category/accelerator/collision issues have stable codes and paths | RD-02 FR-10/11 |

### Framework integration

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-30 | `createApplication({caps,i18n})` | `app.i18n` is reference-equal to supplied service | RD-03 FR-1 |
| ST-31 | `createApplication({caps})` and existing UI snapshots | Private English service exists and rendered bytes remain identical | RD-03 FR-1/2 |
| ST-32 | Inspect package graphs | UI/Forms/Files/Datagrid directly depend on i18n; Core does not | RD-03 FR-3 |
| ST-33 | Construct a modal host with `i18n`, and call standard button factories with an explicit service and no argument | Hosted helper uses `host.i18n`; direct optional-service button factories use the explicit service or their private English default without global state | RD-03 FR-4 |
| ST-34 | Build a service from fixture-owned Dutch framework, Dutch application, and English application catalogs using `ui.action.ok` | Dutch app override wins same-locale; Dutch framework beats English app override; the fixture does not require a Phase 4 locale export | RD-03 FR-5 |
| ST-35 | Calendar under each explicit locale and no-config | Explicit locale renders localized names/Today; no-config bytes remain English | RD-03 FR-6 |
| ST-36 | DatePicker explicit week start, locale convention, and no-config | Explicit option wins; convention applies only with explicit i18n; value stays ISO | RD-03 FR-6 |
| ST-37 | Switch with no label and explicit caller label | Default localizes; explicit label is unchanged | RD-03 FR-7 |
| ST-38 | Standard dialog/message/editor flows in a non-English app | Package-owned labels/messages localize and accelerators remain functional | RD-03 FR-8 |
| ST-39 | FormDialog default and explicit OK label | Default localizes; explicit label is unchanged | RD-03 FR-9 |
| ST-40 | File dialogs with localized service and real fixture paths | UI metadata/actions/errors localize; filenames/paths/extensions remain byte-identical | RD-03 FR-10 |
| ST-41 | Datagrid empty/filter/personalization/boolean defaults and caller titles/values | Framework text localizes; caller/data text is unchanged | RD-03 FR-11 |
| ST-42 | Locale-sensitive framework search/collation with explicit and absent i18n | Explicit path uses NFC+locale behavior; no-config path preserves current results | RD-03 FR-12 |
| ST-43 | Render representative package dialogs for all ten locales at 80×24 | No required control overlaps/escapes; labels and accelerators are display-cell valid | RD-03 FR-13 |

### Locales, documentation, and plugin

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-44 | Import each of 40 package/locale subpaths | ESM and declarations resolve to one correctly tagged schema-1 catalog | RD-04 FR-1 |
| ST-45 | Bundle each package main entry | No non-English catalog strings or all-locale registry is reachable | RD-04 FR-1 |
| ST-46 | Compare all official catalogs with English | Exact key/kind/placeholder parity; strict validation has no issue | RD-04 FR-2/3 |
| ST-47 | Verify official accelerator scope manifests | Every required label has one ASCII letter and no scope collision | RD-04 FR-3 |
| ST-48 | Invalid app accelerator override for one key | Only that override is ignored and valid English default renders | RD-04 FR-3 |
| ST-49 | Review manifest with matching approved proficient-human or AI-assisted review | Review verifier passes for that catalog digest and rejects undisclosed methods | RD-04 FR-4 |
| ST-50 | Missing, unapproved, duplicate, or stale review digest | Release review verifier fails and identifies locale/package structurally | RD-04 FR-4 |
| ST-51 | Run docs snippets and Theme Designer localization recipe | Every snippet typechecks/runs against public APIs | RD-04 FR-5/6 |
| ST-52 | Generate API docs | I18n public surface and locale entry points are linked and JSDoc-complete | RD-04 FR-5 |
| ST-53 | Run plugin impact mapping after mapped SDK changes | Every reported canonical reference is reviewed and generated copy matches | RD-04 FR-7 |
| ST-54 | Run localized app recipe from canonical Codex skill | Generated app uses explicit locale imports, app catalog last, one service, and injection; it typechecks | RD-04 FR-7 |
| ST-55 | Run fixed cold/warm benchmark and `yarn verify` | Published threshold passes, all package/plugin/docs gates pass, no compatibility regression | RD-04 FR-8–10 |

## Test files

| File family | ST cases |
|---|---|
| `packages/i18n/test/engine.spec.test.ts` | ST-01–ST-16 |
| `packages/i18n/test/sources.spec.test.ts` | ST-17–ST-20 |
| `packages/i18n/test/node-loader.spec.test.ts` | ST-21–ST-29 |
| `packages/ui/test/i18n.spec.test.ts` | ST-30–ST-38 |
| `packages/forms/test/i18n.spec.test.ts` | ST-39 |
| `packages/files/test/i18n.spec.test.ts` | ST-40 |
| `packages/datagrid/test/i18n.spec.test.ts` | ST-41–ST-42 |
| `packages/examples/test/i18n-layout.spec.test.ts` | ST-43 |
| `packages/i18n/test/locales.spec.test.ts` | ST-44–ST-50 |
| `packages/docs-site/test/i18n-docs.spec.test.ts` | ST-51–ST-52 |
| `tools/jsvision-skill/test/i18n-plugin.spec.test.ts` | ST-53–ST-54 |
| `packages/i18n/test/performance.spec.test.ts` | ST-16, ST-55 |

Implementation tests are split by module (`locale`, `messages`, `validation`, `cache`,
`strict-json`, `json-file-source`, and each package's literal/layout helpers) and use
`*.impl.test.ts`. Integration tests use built artifacts and real package export resolution.

## Fixtures and adversarial data

- Minimal English/Polish/region-layer catalogs and all supported message kinds.
- Temporary rooted filesystem containing valid files, sibling-prefix roots, nested symlinks,
  non-regular targets where supported, invalid UTF-8, duplicate JSON, and exact limit boundaries.
- Ten-locale 80×24 application snapshots using ASCII, accents, and wide Unicode where appropriate.
- Digest-bound translation review fixtures containing valid and deliberately stale approvals.
- A temporary consumer workspace for package and Codex-plugin recipe resolution.

## Verification checklist

- [ ] Every ST case is authored before its implementation and observed red.
- [ ] Spec expectations are never changed to fit implementation.
- [ ] Package-local typecheck/build/test/docs gates pass after each focused task.
- [ ] Security and parser adversarial suites pass on supported platforms.
- [ ] Generated files are deterministic and plugin drift is clean.
- [ ] `yarn verify` passes.
- [x] Method-disclosed translation review evidence passes the digest verifier.
