# RD-04: Quality, Documentation, and Plugin Governance

> **Document**: RD-04-quality-docs-plugin.md
> **Status**: Draft
> **Created**: 2026-07-25
> **Project**: jsvision i18n feature set
> **Depends On**: RD-01, RD-02, RD-03
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Make internationalization a maintained SDK guarantee rather than an isolated translator. This RD
owns the ten official catalogs, method-disclosed review evidence, English compatibility,
cross-runtime/security/performance verification, consumer documentation, and the canonical JSVision
Codex plugin guidance. *(AR #2, AR #3, AR #11, AR #13, AR #24–AR #26)*

## Functional Requirements

### Must Have

- [ ] **FR-1 — Official locales.** UI, Forms, Files, and Datagrid ship complete catalogs for:
      `en`, `nl`, `de`, `fr`, `es`, `it`, `pt-PT`, `pl`, `ro`, and `sv`. English is the default,
      reference, and final catalog fallback. Region variants outside this list are application-owned.
      *(AR #2, AR #3)*
- [ ] **FR-2 — Review evidence.** A versioned review manifest records, for every package/locale
      catalog, its normalized content digest, review status, reviewer identity, disclosed review
      method, and review date. Accepted methods are `proficient-human` and `ai-assisted`; AI review
      must never be represented as human proficiency. Any catalog change invalidates its prior
      review entry. Unreviewed machine drafts may exist during development but cannot satisfy
      release readiness or be described as reviewed translations. *(AR #3, AR #25)*
- [ ] **FR-3 — Completeness gate.** Official catalogs must match their package English reference
      key-for-key, message-kind-for-kind, placeholder-for-placeholder, valid plural categories,
      accelerator scope rules, and layout inventory. Missing/extra/mismatched values fail the owning
      package test and full verification. *(AR #3, AR #10, AR #26)*
- [ ] **FR-4 — English compatibility.** Requirement-derived golden/spec tests capture every migrated
      no-configuration screen/string before production changes. Implementation preserves exact text,
      spacing, accelerators, command behavior, sorting behavior, DatePicker order, and default week
      start. *(AR #5, AR #9, AR #24)*
- [ ] **FR-5 — Specification-first testing.** For each RD, create requirement-derived
      `*.spec.test.ts`, run it red against missing behavior, implement to green, then add internal
      `*.impl.test.ts`. Security cases include validation, terminal controls, path traversal,
      symlinks, duplicate JSON, resource exhaustion, abort, optional failures, and throwing sinks.
      *(AR #17, AR #18, AR #26)*
- [ ] **FR-6 — Runtime and packaging matrix.** Unit and integration behavior is equal on Node and
      the browser-safe web build. Packaging tests prove the main entry contains no `node:*`, locale
      subpaths include only selected data, Node APIs remain under `/node`, declarations/maps ship,
      and all published packages declare the correct direct dependency. *(AR #1, AR #8, AR #22,
      AR #26)*
- [ ] **FR-7 — Layout/accelerator matrix.** Every official locale validates all package accelerator
      scopes and renders every localized composite at 80×24 without semantic clipping. Smaller
      viewport tests prove actions remain operable. *(AR #3, AR #9, AR #10, AR #26)*
- [ ] **FR-8 — Performance gate.** Warm `t()` performs no parsing, catalog validation, or new `Intl`
      construction. On the repository Node 22 CI reference, 100,000 simple warm translations complete
      within 250 ms. Formatter caches remain bounded at 64 entries per family and diagnostics at 100.
      Main-package import has zero runtime dependencies and does not import official locale catalogs.
      *(AR #20, AR #26)*
- [ ] **FR-9 — Consumer documentation.** Package and docs-site material explains installation,
      catalog schema, locale/fallback behavior, plural/select/interpolation, application injection,
      package locale imports, custom/JSON sources, diagnostics, strict validation, accelerators,
      calendar/date/currency/time-zone boundaries, Node/browser entry points, and migration from
      hardcoded strings. Examples are executable or sourced from tested modules. *(AR #4, AR #6,
      AR #9–AR #11)*
- [ ] **FR-10 — Executable application recipe.** Add a small application-owned translation example
      that loads framework and app catalogs, creates the service, injects it into Application, renders
      a plural/select message, and validates its catalogs. It proves the application use case without
      translating Theme Designer. *(AR #1, AR #13, AR #22)*
- [ ] **FR-11 — Canonical Codex skill.** Update `tools/jsvision-skill/` with a dedicated
      `references/i18n.md` and routing that teaches when/how to use the package, startup/injection,
      app and framework catalogs, plural/select/defaults, validation, accelerators/layout, and
      browser/Node boundaries. Add generated API coverage and a synchronized recipe. *(AR #11)*
- [ ] **FR-12 — Plugin impact and generation.** Add all i18n-owned source paths to
      `tools/jsvision-plugin-impact.json`, including guide, application lifecycle, recipes, and API
      references. Run `yarn plugin:update`; never edit the generated
      `plugins/jsvision-plugin/skills/jsvision/` copy directly. `yarn plugin:check` and
      `yarn verify` must pass. *(AR #11, AR #26)*
- [ ] **FR-13 — Attribution and release notes.** Publish MIT/TrueSoftware attribution for the
      BlendSDK-derived baseline and document the intentional API differences: locale-scoped schema,
      CLDR plurals, select/default messages, strict loaders, diagnostics, explicit package catalogs,
      and absence of ContentFileSource. Add package changelogs and consumer migration notes.
      *(AR #24, AR #29)*

### Should Have

- [ ] **FR-14 — Contributor workflow.** Document how to add a key or locale, run strict validation,
      collect review evidence, test accelerators/layout, and regenerate plugin artifacts. *(AR #3,
      AR #10, AR #11, AR #25)*

### Won't Have (Out of Scope)

- Representing AI-assisted review as proficient-human review.
- Publishing unrevised catalogs as official.
- Code-editor plugin guidance or implementation; GitHub issue #184 owns that future work.
- Full Theme Designer localization, translation-management SaaS integration, or automatic extraction.

## Technical Requirements

### T-1 Review manifest

The manifest uses stable package and canonical locale identifiers. Each entry contains:

```json
{
  "package": "ui",
  "locale": "nl",
  "digest": "<normalized-sha256-catalog-digest>",
  "reviewer": "<reviewer identity>",
  "reviewMethod": "ai-assisted",
  "reviewedAt": "YYYY-MM-DD",
  "status": "approved"
}
```

The gate computes the digest; it never trusts a stale declared digest. Every non-English entry
requires an approved review using one of the two disclosed methods. Future proficient-human review
may supersede AI-assisted evidence by replacing the single digest-bound entry. *(AR #3, AR #25)*

### T-2 Required test groups

| Group | Required evidence |
|---|---|
| Engine specification | Locale/fallback/layers/defaults/interpolation/plural/select/diagnostics |
| Loader security | Traversal, symlink, duplicate JSON, UTF-8, controls, bounds, abort |
| Framework compatibility | Pre/post English goldens and explicit option precedence |
| Locale quality | Completeness, placeholder parity, plural categories, review digest |
| UX | Scoped accelerators and 80×24 plus undersized operability |
| Packaging | Browser import graph, Node subpath, locale tree-shaking, declarations |
| Performance | Warm 100k budget, no hot-path constructors, bounded caches |
| Plugin | Generated API/recipe/impact snapshot drift |

### T-3 Verification order

Focused package `typecheck`, `test`, and `check:docs` run during iteration. Before any task is
committed, its plan-defined focused gate passes. Before the feature is complete:

1. `yarn plugin:update`
2. `yarn plugin:check`
3. `yarn verify`

The final verification includes a clean generated-plugin diff and review-manifest validity.
*(AR #11, AR #26)*

### T-4 Commonly forgotten requirements

| Concern | Disposition |
|---|---|
| Audit/activity trail | N/A; local translation library. Review manifest supplies catalog governance. |
| Data export/import | JSON catalog loading is covered; no business-data export. |
| API versioning | Schema 1 and SemVer-governed message keys/public exports. |
| Rate limiting/auth/sessions | N/A; custom remote source caller-owned. |
| Empty/loading states | Empty catalogs and async startup failures are specified. |
| Accessibility | Accelerator reachability and semantic clipping are covered; RTL deferred. |
| Backup/DR | Source catalogs remain application/repository-owned; atomic in-memory publication only. |
| Monitoring | Structured diagnostics are exposed; application owns transport/alerts. |
| Search/pagination/uploads/delete | N/A to catalog engine; locale search behavior is covered. |
| Time zones/currency | Explicit boundaries in RD-01/RD-03. |
| GDPR/retention/secrets/encryption | Catalogs must contain no PII/secrets; remote transport caller-owned. |
| Offline/graceful degradation | Embedded English and call-site defaults work without external sources. |
| Configuration | Explicit locale, fallback, sources, strict validation, and formatter options. |
| Injection/security tests | Mandatory in RD-01/RD-02 and this verification matrix. |

## Integration Points

- RD-01 and RD-02 supply the package contracts and security behavior documented here.
- RD-03 supplies the package inventories, accelerator scopes, localized composites, and example APIs.
- The docs-site and canonical plugin consume tested source examples and generated API references.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Languages | Core six / recommended ten / broader set | Recommended ten | User-selected mainstream European coverage | AR #2 |
| Review | Unreviewed machine draft / proficient human / disclosed AI-assisted review | Digest-bound proficient-human or AI-assisted evidence plus automated gates | Review remains auditable when proficient speakers are unavailable, without misstating who performed it | AR #3, AR #25 |
| Agent support | Generic docs / canonical skill integration | Canonical skill integration | Plugin is a supported SDK surface | AR #11 |
| Proof app | Theme Designer / focused recipe | Focused recipe | Tests app ownership without scope expansion | AR #13 |

## Security Considerations

- Release validation rejects unsafe catalog/parameter content and tests every loader boundary.
- Review manifests contain reviewer identity but no credentials; repository access policy governs them.
- Documentation never suggests putting secrets, tokens, personal data, or untrusted HTML in catalogs.
- Remote examples state that callers own TLS, authentication, authorization, rate limits, secret
  management, response-size limits, and retention.
- Published packages contain attribution and no hidden dependency on the source repository.

## Acceptance Criteria

1. [ ] All framework packages have 100% key/kind/placeholder coverage for all ten locales and every
       non-English catalog digest has current review evidence with its method disclosed.
2. [ ] Any one-character catalog edit invalidates its review digest and causes release readiness to fail.
3. [ ] English no-configuration goldens are byte-identical before and after migration.
4. [ ] The complete security, runtime, packaging, locale, layout, accelerator, and performance matrix passes.
5. [ ] The executable recipe typechecks/tests and its synchronized plugin snippet matches the source.
6. [ ] `tools/jsvision-skill/` contains the routed i18n guide, generated API includes
       `@jsvision/i18n`, impact mapping covers all feature paths, and generated plugin drift is zero.
7. [ ] MIT/TrueSoftware attribution and migration notes ship with `@jsvision/i18n`.
8. [ ] `yarn plugin:check` and `yarn verify` both exit zero after generated artifacts are refreshed.
