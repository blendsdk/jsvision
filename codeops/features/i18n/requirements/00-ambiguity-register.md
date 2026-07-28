# Ambiguity Register: JSVision Internationalization

> **Status**: ✅ GATE PASSED — all 29 items resolved
> **Last Updated**: 2026-07-28
> **Feature-Set**: i18n (`codeops/features/i18n/`)
> **Mode**: auto-design
> **Root Invocation ID**: `i18n-20260725-01`
> **Policy Version**: 1

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| 1 | Feature / scope | Who owns translations and where must they run? | Framework only / applications only / both across Node and web | **Both** framework and application messages; Node terminal and `@jsvision/web` browser runtimes | ✅ Resolved |
| 2 | Scope / locales | Which locales ship as complete official catalogs? | Core six / recommended ten / broader European set | **Recommended ten**: `en`, `nl`, `de`, `fr`, `es`, `it`, `pt-PT`, `pl`, `ro`, `sv`; English is default and final fallback | ✅ Resolved |
| 3 | Quality | What makes an official translation releasable? | Machine draft / automated completeness only / complete plus disclosed review | **100% coverage, valid plurals/accelerators/layout, and digest-bound review whose method is disclosed as proficient-human or AI-assisted** | ✅ Resolved |
| 4 | Lifecycle | How does i18n enter an application? | Global mutable singleton / asynchronous application factory / preloaded explicit service | **Load first, then pass the synchronous service to synchronous `createApplication({ i18n })`; expose the exact instance as `app.i18n`; no global mutable translator** | ✅ Resolved |
| 5 | Behavior | How do missing locale data, messages, and parameters behave? | Throw / expose keys / deterministic safe fallback | **Region → language → configured fallback → call-site default; missing params remain visible and diagnostic; missing key without a default returns the key** | ✅ Resolved |
| 6 | Data / messages | Which v1 message capabilities and authoring shape are supported? | Strings only / ICU parser / typed string plus one-level structured plural/select | **`${name}` interpolation, `plural()` and `select()` with mandatory `other`, cardinal `Intl.PluralRules`, and equivalent schema-versioned TS/JSON forms** | ✅ Resolved |
| 7 | Scope | Which advanced capabilities are excluded from v1? | Full ICU/runtime switching/rich text / bounded first release | **No ordinals, nested messages, HTML/rich text, extraction/type generation, file watching, runtime locale switching, or RTL guarantee** | ✅ Resolved |
| 8 | Integration | Which packages directly integrate? | UI only / UI+Files+Datagrid / all framework packages with owned user-facing strings | **UI, Forms, Files, and Datagrid depend directly on i18n and own catalogs; Core remains unchanged** | ✅ Resolved |
| 9 | UX | What localization affects layout and locale conventions? | Text substitution only / locale-aware controls with bounded responsive layout | **Translate framework labels/calendar data, apply explicit-locale week conventions and metadata formatting, measure display cells, and pass all ten locales at 80×24** | ✅ Resolved |
| 10 | UX / accelerators | How are translated accelerator markers validated and recovered? | Ignore / warn only / official hard gate plus safe app fallback | **Official malformed/colliding groups fail; invalid app overrides fall back to English with diagnostics; app collisions warn or fail strict CI** | ✅ Resolved |
| 11 | Integration / agents | Is Codex plugin support part of the SDK feature? | Documentation only / canonical skill plus generated references and impact checks | **Update canonical skill, dedicated guide, recipes, API generation, impact mapping, generated copy, plugin checks, and full verification** | ✅ Resolved |
| 12 | Scope | Is `@jsvision/code-editor` included? | Include unseen package / compatibility placeholder / separate follow-up only | **Excluded completely from this feature plan; track only in GitHub issue #184** | ✅ Resolved |
| 13 | Scope / adoption | Must a full private application be translated as proof? | Translate Theme Designer / executable focused recipe | **Use a drift-checked executable application-owned translation recipe; Theme Designer localization is not required in v1** | ✅ Resolved |
| 14 | Data / compatibility | How are catalog schema versions and future migrations handled? | Best-effort parse / only schema 1 accepted with typed rejection / multi-version adapters from day one | **Accept schema 1 exactly; reject unknown versions with a structured error; add explicit adapters only when a future schema exists** | ✅ Resolved |
| 15 | Data / layering | What are catalog precedence, duplicate, and atomic replacement semantics? | Object merge / ordered immutable layers with atomic overlay / mutable shared registry | **Locale-first ordered layers, later layer wins within a locale; validated copy-on-write `setCatalog()` replaces one runtime locale overlay atomically** | ✅ Resolved |
| 16 | Integration / sources | What is the asynchronous source and cancellation contract? | Built-in network/filesystem orchestration / custom sources with caller cancellation / no async abstraction | **Custom sources receive `AbortSignal`; required and optional results validate before one publication; caller owns timeout and network transport** | ✅ Resolved |
| 17 | Security / loader | How does the Node JSON loader prevent traversal, symlink escape, control injection, and resource exhaustion? | Trust caller / rooted validated loader / sandboxed process | **Node-only rooted loader with canonical containment, regular `.json` file and UTF-8 checks, strict duplicate detection, control validation, abort support, and bounded input** | ✅ Resolved |
| 18 | Behavioral / diagnostics | What structured errors and diagnostic-handler failure behavior are public? | Strings and console warnings / typed codes and non-throwing sink / exceptions for all faults | **Stable typed error/diagnostic codes; bounded deduplicated diagnostics contain no values; sink failures never break translation** | ✅ Resolved |
| 19 | Technical / locale | How does explicit `locale: 'auto'` detect and canonicalize a locale consistently? | Environment-specific adapters / `Intl` resolved locale / direct environment-variable parsing | **Use `Intl.DateTimeFormat().resolvedOptions().locale`; normalize explicit POSIX forms before BCP-47 canonicalization; invalid explicit locales fail configuration** | ✅ Resolved |
| 20 | Technical / Intl | How are plural, number, date, collation, and formatter performance made consistent? | Construct per call / cached service-owned `Intl` objects / global cache | **Precompile templates; use bounded service-owned `Intl` caches and locale-aware comparison/search; never construct formatters in the draw hot path** | ✅ Resolved |
| 21 | API | Which service introspection is public? | Translation only / locale and availability metadata / expose internal resolution graph | **Readonly requested locale, fallback locales, available locales, `has()`, validation APIs, and structured diagnostics; no internal graph exposure** | ✅ Resolved |
| 22 | Integration / bundles | How do applications load package-owned official catalogs without global registration or circular dependencies? | Automatic global registry / explicit package catalog bundles / central all-package bundle | **Explicit locale subpath catalog imports from each owning package, ordered before application catalogs; no registry or all-locale main-bundle side effect** | ✅ Resolved |
| 23 | Edge cases | How do invalid select parameters and plural/select composition behave? | Throw / diagnostic plus `other`; one structured level / implicit nested evaluation | **Missing/invalid controllers diagnose and select `other`; cases contain strings only; no plural/select nesting in v1** | ✅ Resolved |
| 24 | Compatibility | How are existing English literals and public message keys migrated? | Immediate replacement without oracle / byte-golden migration and stable namespaced keys / dual APIs indefinitely | **Inventory built-in literals, preserve English golden output and existing explicit label overrides, and govern namespaced message keys as stable public API** | ✅ Resolved |
| 25 | Quality / governance | How is translation review represented at release time? | Informal assertion / human-only attestation / durable method-disclosed evidence tied to catalog revision | **Durable digest-bound review is mandatory; evidence identifies the reviewer and whether the review was proficient-human or AI-assisted, without representing AI review as human proficiency** | ✅ Resolved |
| 26 | Non-functional | What verification and performance constraints govern the synchronous draw path? | Functional tests only / specification, integration, locale matrix, security, bundle and cache verification | **Specification-first unit/integration/security/package tests, English goldens, ten-locale layout/accelerator matrix, bounded caches, zero runtime dependencies, and hot-path benchmarks** | ✅ Resolved |
| 27 | Security / boundary | Do authentication, authorization, retention, encryption, rate limiting, or network security apply? | Treat catalogs as network service / explicitly local library boundary | **The package is a local library with no auth, endpoint, storage, or network ownership; custom-source callers own transport security, authorization, rate limits, secrets, and retention** | ✅ Resolved |
| 28 | API / typing | Are message keys generated or statically constrained in v1? | Generated union / generic key parameter / stable string keys with validation | **No extraction or generated key types in v1; keys remain stable public namespaced strings** | ✅ Resolved |
| 29 | Legal / provenance | May BlendSDK source be copied into the JSVision-owned implementation? | Verified-license source port / clean-room behavior-compatible implementation | **Port from the user-provided `blendsdk-v5/packages/i18n` MIT source into a JSVision-owned implementation; preserve attribution and do not retain a BlendSDK runtime dependency** | ✅ Resolved |

## Resolution Notes

**AR-1–AR-13, AR-25, AR-28:** These rows record explicit user decisions from the completed
discovery rounds and the user's bulk confirmations. The detailed accepted behavior is preserved in
`requirements/_draft/discovery-notes.md`.

**AR-14 — Catalog schema evolution**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Version-dispatch mechanism within the confirmed schema-versioned catalog behavior.
- **Objective:** Reject ambiguous data without prebuilding speculative migrations.
- **Decision:** Accept exactly schema `1`; emit `UNSUPPORTED_SCHEMA` for every other value.
- **Evidence:** No earlier JSVision catalog format exists to migrate.
- **Rejected alternatives:** Best-effort parsing hides incompatibility; multi-version adapters have
  no second schema to target.
- **Strongest counterargument:** A permissive reader can ease early experimentation, but it makes a
  supposedly versioned contract non-deterministic.
- **Confidence:** High; reopen when schema 2 is designed.
- **Hardening:** Independent challenger converged.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** An approved schema 2 or an external catalog compatibility obligation.

**AR-15 — Catalog layering and replacement**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Consistency and data-structure mechanism within accepted override and atomicity policy.
- **Objective:** Preserve deterministic app overrides and old-or-new visibility without a global registry.
- **Decision:** Resolve every locale from newest to oldest layer before moving to the next fallback
  locale. Initial layers are immutable. `setCatalog(catalog)` validates and atomically swaps one
  highest-priority runtime overlay for that locale by copy-on-write; rejection leaves the prior snapshot.
- **Evidence:** App catalogs must override package catalogs, translation calls are synchronous, and the
  user explicitly accepted catalog replacement atomicity.
- **Rejected alternatives:** Key-first fallback lets English app text suppress localized framework text;
  a mutable shared registry breaks ordering and tree-shaking; removing replacement contradicts discovery.
- **Strongest counterargument:** A snapshot-level `replaceCatalogs()` is simpler for multi-locale updates;
  v1's fixed locale makes a one-locale atomic overlay sufficient.
- **Confidence:** High; reopen if runtime locale switching or multi-locale transactional updates enter scope.
- **Hardening:** Challenger initially preferred immutable-only or snapshot replacement; reconciliation
  retained the user-authorized `setCatalog()` capability with copy-on-write semantics.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** Runtime locale switching, file watching, or a requirement for cross-locale transactions.

**AR-16 — Asynchronous translation sources**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Failure, cancellation, and concurrency mechanism within accepted custom-source scope.
- **Objective:** Publish only complete validated state and leave transport policy to applications.
- **Decision:** A source receives `{ signal }` and returns one catalog or a catalog list. `loadI18n`
  accepts an `AbortSignal`, awaits required and optional sources, skips diagnosed optional failures,
  rejects any required failure, validates the complete result, then constructs one service. No built-in
  HTTP source or internal timeout ships; callers compose either.
- **Evidence:** Node and browser need the same abstraction; only the Node JSON loader is first-party.
- **Rejected alternatives:** Built-in fetch introduces transport/auth policy and environment variance;
  no async abstraction forces every app to reinvent atomic loading.
- **Strongest counterargument:** Awaiting optional sources may delay startup; callers can abort or split
  nonessential application loading outside the required startup set.
- **Confidence:** High; reopen if streaming or background locale updates enter scope.
- **Hardening:** Independent challenger converged.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** Background refresh, streaming catalogs, or a first-party remote service.

**AR-17 — Catalog and Node-loader hardening**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Security mechanisms within the accepted secure-loader and control-rejection policy.
- **Objective:** Prevent path escape, terminal injection, parser ambiguity, and unbounded local input.
- **Decision:** `@jsvision/i18n/node` requires an explicit root and relative `.json` path, resolves real
  paths, rejects root/symlink escape and non-regular files, validates UTF-8 with a strict JSON parser that
  detects duplicate members, and checks cancellation. Defaults are 2 MiB per file, 10,000 keys per
  catalog, 512 Unicode scalar values per key, and 65,536 UTF-8 bytes per message. Catalogs are copied
  into internal `Map` storage and frozen public values. Reject lone surrogates, bidi overrides, DEL/C1,
  and C0 controls except LF in catalog text and interpolated parameters.
- **Evidence:** JSON.parse silently accepts duplicate members; terminal strings reach a privileged output
  surface; the package has no server sandbox.
- **Rejected alternatives:** Trusting local callers leaves traversal/symlink and terminal-control hazards;
  a subprocess sandbox is disproportionate for static JSON.
- **Strongest counterargument:** Fixed caps can reject unusually large applications; custom sources can
  segment catalogs and the Node loader exposes lower configurable caps, never higher than hard safety maxima.
- **Confidence:** Medium; change if real catalog measurements exceed the proposed bounds.
- **Hardening:** Challenger added duplicate-member detection, parameter validation, bidi/lone-surrogate
  checks, and pre-read byte limits. Challenger converged after those additions.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** Measured legitimate catalogs exceed limits or Node adds a suitable strict JSON primitive.

**AR-18 — Errors and diagnostics**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Public failure-reporting mechanism within accepted diagnostic behavior.
- **Objective:** Make faults machine-testable without leaking values or corrupting a terminal session.
- **Decision:** Configuration/loading/validation failures throw `I18nError` with stable codes and structured
  issues. Runtime fallback records bounded, deduplicated diagnostics containing code, severity, key, locale,
  and source only—never parameter values or translated text—and invokes an optional sink. Sink exceptions
  are swallowed. The service never writes directly to terminal stdout/stderr.
- **Evidence:** Existing UI warnings use process/console behavior unsuitable for a browser-safe package and
  can interfere with an owned terminal.
- **Rejected alternatives:** Plain strings are not robust for CI; exceptions for missing runtime messages
  violate safe fallback; direct console warnings can corrupt TUI output.
- **Strongest counterargument:** Retained diagnostics add state to the service; a strict bound and dedupe
  prevent growth and make the state observable for development.
- **Confidence:** High; reopen if JSVision gains a cross-runtime diagnostics service.
- **Hardening:** Independent challenger converged.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** A shared diagnostics/logging abstraction becomes available.

**AR-19 — Locale canonicalization and auto detection**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Locale detection algorithm within explicit opt-in auto behavior.
- **Objective:** Use one browser-safe mechanism while accepting common POSIX locale inputs.
- **Decision:** Explicit strings strip `.encoding` and `@modifier`, replace `_` with `-`, map `C`/`POSIX`
  to `en`, and then use `Intl.getCanonicalLocales`; invalid input throws `INVALID_LOCALE`. `auto` uses
  `Intl.DateTimeFormat().resolvedOptions().locale`. Unicode extensions remain available to formatting
  but are stripped from catalog lookup; catalog locale declarations reject extensions.
- **Evidence:** Node 22 rejects raw `en_US.UTF-8`; runtime `Intl` already resolves its host preference.
- **Rejected alternatives:** Direct environment-variable parsing is Node-only; platform adapters expand
  API and bundle surface without improving the resolved locale.
- **Strongest counterargument:** Browser `navigator.languages` can express multiple preferences; v1 has
  one requested locale plus an explicit fallback list and does not promise language negotiation.
- **Confidence:** High; reopen if multi-preference negotiation is added.
- **Hardening:** Challenger preferred browser navigator precedence; reconciliation kept the single-runtime
  `Intl` result because the confirmed API selects one locale and requires Node/browser parity.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** Accept-Language negotiation or multiple requested locales enter scope.

**AR-20 — Intl behavior and hot-path caching**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Performance/data-structure mechanism within confirmed locale formatting and collation.
- **Objective:** Keep synchronous rendering deterministic without repeated parser or formatter construction.
- **Decision:** Validate and compile templates at catalog publication. Cache `Intl.PluralRules`,
  `NumberFormat`, `DateTimeFormat`, and `Collator` per service with canonical allowlisted option keys and
  a 64-entry LRU per formatter family. Ordering/equality uses `Collator`; contains/prefix/suffix search
  uses NFC plus `toLocaleLowerCase`. Existing custom comparators win. Framework code uses these paths
  only when i18n was explicitly supplied, preserving host-default no-configuration behavior.
- **Evidence:** Datagrid currently caches host-default collators globally while filters use plain lowercase;
  repeated `Intl` construction is unsuitable inside draw/sort loops.
- **Rejected alternatives:** Per-call construction is slow; global caches leak locale/options between apps
  and can grow for process lifetime.
- **Strongest counterargument:** A 64-entry LRU is more machinery than most apps need; option-bearing
  public formatters otherwise permit unbounded adversarial combinations.
- **Confidence:** Medium; adjust the bound from benchmark and workload evidence.
- **Hardening:** Challenger added locale-aware substring normalization and bounded option caches.
  Challenger converged on the service-owned design.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** Benchmarks show regression or legitimate applications churn beyond the cache bound.

**AR-21 — Public service introspection**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Supporting API shape within the confirmed translation service.
- **Objective:** Enable application diagnostics and strict CI without exposing mutable internals.
- **Decision:** Expose readonly `locale`, `fallbackLocales`, and `availableLocales`; `has(key, locale?)`;
  bounded readonly diagnostics; `validateCatalog()` and `validateCatalogs()`. Do not expose internal layers,
  compiled templates, caches, or a mutable resolution graph.
- **Evidence:** Apps and plugin recipes need to test availability and validate partial/strict catalogs.
- **Rejected alternatives:** Translation-only forces trial calls; exposing the layer graph freezes internal
  data structures as public API.
- **Strongest counterargument:** `has()` can encourage conditional UI; documentation will position it as
  tooling/introspection, not a substitute for call-site defaults.
- **Confidence:** High; reopen if generated key typing removes runtime validation needs.
- **Hardening:** Independent challenger converged.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** Key generation/type extraction enters scope.

**AR-22 — Framework catalog composition and bundle boundaries**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Dependency and module-composition mechanism within accepted package ownership.
- **Objective:** Make package translations discoverable without global registration, circular dependencies,
  or loading ten locales into every application.
- **Decision:** Each owning package exports one browser-safe locale subpath per official catalog, such as
  `@jsvision/files/i18n/de`, whose named `catalog` export is passed explicitly to `createI18n` or
  `loadI18n`. Package catalogs precede application catalogs. Main entries do not import all locale data.
  UI re-exports core authoring/service APIs, while Node loaders remain only at `@jsvision/i18n/node`.
- **Evidence:** `app.i18n` must remain the caller's exact instance and standalone widgets cannot discover
  package catalogs without explicit composition or global mutation.
- **Rejected alternatives:** Global registration breaks determinism/tree-shaking; a central all-package
  bundle creates reverse dependencies and unnecessary code; derived resolver facades violate exact-instance
  expectations.
- **Strongest counterargument:** Explicit imports are more verbose; the Codex plugin and executable recipe
  will generate the complete package list and preserve transparency.
- **Confidence:** High; reopen if package count makes explicit composition demonstrably unusable.
- **Hardening:** Challenger identified this as the largest missing architecture point and converged on
  explicit package bundles.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** A stable dependency-injection/plugin registry is introduced at application construction.

**AR-23 — Structured-message edge behavior**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Message evaluator mechanism within accepted plural/select scope.
- **Objective:** Guarantee total synchronous evaluation without hidden recursion.
- **Decision:** JSON uses `{ kind, parameter, cases }`; case values are strings. `select` accepts only
  string, finite number, boolean, or bigint controller values and exact stringified case matching.
  Missing/invalid plural or select controllers record a diagnostic and select `other`; unresolved
  placeholders remain visible. `$${name}` emits literal `${name}`. Arbitrary object coercion is forbidden.
- **Evidence:** Nested messages are excluded and arbitrary `toString()` can execute caller code.
- **Rejected alternatives:** Throwing breaks safe UI fallback; recursive evaluation silently reintroduces
  nested-message complexity.
- **Strongest counterargument:** One-level messages cannot combine gender and plural; that remains an
  explicitly deferred v2 capability.
- **Confidence:** High; reopen when nested composition or ordinals are proposed.
- **Hardening:** Challenger added primitive-only controllers and explicit interpolation escaping.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** Nested messages, ordinal plurals, or rich message ASTs enter scope.

**AR-24 — English compatibility and key migration**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Reversible migration/testing mechanism within the accepted byte-compatible outcome.
- **Objective:** Move built-in text behind catalogs without changing existing application behavior.
- **Decision:** Produce a reviewed inventory of built-in user-visible literals. Every migrated call retains
  its exact English call-site default and existing explicit label option precedence. Golden/spec tests freeze
  no-configuration output. Keys use package-prefixed dotted namespaces and follow SemVer deprecation/removal.
- **Evidence:** The audit found built-in text across dialogs, calendars, Files, Forms, and Datagrid rather
  than only the initially named dialogs.
- **Rejected alternatives:** A hand-picked list misses strings; dual literal/catalog APIs indefinitely
  create two behavior paths.
- **Strongest counterargument:** Golden tests can preserve accidental spacing; byte compatibility is an
  explicit release outcome, so deliberate later changes require normal review.
- **Confidence:** High; reopen if inventory automation identifies caller-owned text mistakenly classified.
- **Hardening:** Challenger expanded the required inventory and converged on golden migration.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** Inventory review changes ownership of a message or a deliberate English UX change is approved.

**AR-26 — Verification and performance**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Test and performance strategy within accepted quality goals.
- **Objective:** Prove contract, security, cross-runtime packaging, translated layout, and draw-path fitness.
- **Decision:** Write immutable requirement-derived `*.spec.test.ts` tests first, confirm red, implement,
  then add `*.impl.test.ts`. Cover schema/fallback/layers/plural/select/interpolation, loader traversal and
  symlink escape, duplicate JSON, controls, size limits, abort/optional sources, sink failure and property
  fuzzing; Node/browser parity; main-entry absence of `node:*`; English goldens; all ten locales' completeness,
  plurals, scoped accelerators, and 80×24 composites. Warm benchmarks must show no template parse/validation
  or `Intl` constructor on repeated `t()` calls and complete 100,000 simple translations within 250 ms on
  the repository's Node 22 CI reference. Main i18n entry has zero runtime dependencies and excludes locale
  catalogs unless imported.
- **Evidence:** `yarn verify` is authoritative and current tests already separate spec/impl coverage.
- **Rejected alternatives:** Functional-only tests miss packaging/security/layout; absolute microbenchmarks
  tighter than this are hardware-flaky.
- **Strongest counterargument:** The 250 ms budget may be too loose to catch smaller regressions; structural
  constructor/parse assertions supply the stronger deterministic oracle.
- **Confidence:** Medium; recalibrate only from recorded CI baseline evidence.
- **Hardening:** Challenger added package-boundary, property, complete-inventory, and review-attestation tests.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** CI hardware cannot meet a stable budget or browser profiling exposes a different bottleneck.

**AR-27 — Security responsibility boundary**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** Classification of non-applicable controls within the confirmed local-library architecture.
- **Objective:** Apply security requirements to the component that actually owns each risk.
- **Decision:** `@jsvision/i18n` owns catalog/parameter validation, terminal-injection resistance, local-file
  containment, resource bounds, and security tests. It owns no accounts, authorization, network endpoint,
  database, secret, retention, encryption, rate limit, container, or deployment. A custom source's application
  owns its transport authentication/authorization, TLS, rate limiting, secrets, persistence, and retention.
- **Evidence:** The package has no network or persistence implementation; custom sources are caller code.
- **Rejected alternatives:** Inventing auth/network controls would expand scope; omitting the boundary could
  imply the library secures arbitrary caller transports.
- **Strongest counterargument:** Examples might be copied into networked apps; documentation must explicitly
  identify the caller-owned boundary.
- **Confidence:** High; reopen if a first-party remote catalog service is added.
- **Hardening:** Independent challenger converged.
- **Policy version:** 1
- **Root invocation ID:** `i18n-20260725-01`
- **Reopen triggers:** First-party network, persistence, or secret-bearing integrations enter scope.

**AR-29 — Upstream provenance**

The user supplied the authoritative source at
`/home/gevik/workdir/github/TrueSoftware/blendsdk-v5/packages/i18n`. Its package manifest and the
repository root manifest both declare MIT licensing, the package identifies TrueSoftware B.V. as
author, and the repository remote is `TrueSoftwareNL/blendsdk`. The earlier user decision was to make
a JSVision-owned port rather than consume the package. The port may therefore reuse suitable source
and tests while preserving MIT/TrueSoftware attribution. JSVision must not depend on
`@blendsdk/stdlib`; its interpolation is reimplemented under the accepted zero-runtime-dependency
contract. BlendSDK's two-form plural tuples, permissive string coercion, heuristic JSON shape
detection, unrooted glob loader, and content-file source do not satisfy the accepted JSVision
requirements and are not compatibility obligations.
