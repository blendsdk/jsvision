# JSVision Internationalization — Requirements Documents

> **Project**: jsvision — first-party internationalization for framework and application messages
> **Status**: Draft
> **Created**: 2026-07-25
> **Architecture**: Node 22+, ESM TypeScript, Yarn workspaces, browser-safe core with Node-only loader
> **CodeOps Artifact Schema**: 1

---

## Overview

JSVision will own a zero-runtime-dependency `@jsvision/i18n` package derived from the MIT-licensed
BlendSDK i18n implementation and redesigned for terminal UI safety, browser parity, CLDR plural
rules, deterministic catalog layering, and application-level dependency injection.

The feature localizes framework-owned messages in UI, Forms, Files, and Datagrid while allowing
applications to supply their own complete or partial catalogs. Existing applications remain
byte-for-byte English-compatible without configuration. Explicitly localized applications load
only the package catalogs and locale data they use, create one service before application
construction, and pass that exact service to `createApplication({ i18n })`. *(AR #1–AR #10,
AR #22, AR #24)*

## Selected Domain Lenses

| Lens | Evidence |
|---|---|
| Data and migration | Catalogs are serialized public artifacts with schema versions, ordered overrides, atomic replacement, validation, compatibility, and review evidence. |

Universal ambiguity, security, compatibility, API, quality, and verification concerns also apply.

## Domain Glossary

| Term | Definition |
|---|---|
| Catalog | One schema-versioned, locale-scoped set of namespaced message keys and validated message values. |
| Catalog layer | One immutable catalog position in an ordered lookup stack; later layers have higher priority within the same locale. |
| Runtime overlay | The highest-priority per-locale catalog installed atomically by `setCatalog()`. |
| Requested locale | The canonical BCP-47 locale selected explicitly or by the opt-in `auto` mode. |
| Resolved message locale | The locale whose catalog or default message supplied the selected message; plural and number formatting use this locale. |
| Call-site default | The English string or structured message supplied with `t()` and used after every catalog fallback. |
| Official catalog | A complete JSVision-owned package catalog for one of the ten supported locales. |
| Application catalog | A consumer-owned catalog that may be partial and overrides package catalogs. |
| Diagnostic | A bounded structured record for a recoverable runtime translation fault; it contains no parameter values or translated text. |
| Strict validation | CI/release validation that rejects missing keys, accelerator collisions, placeholder mismatches, and every catalog structural error. |
| Accelerator scope | A declared group of co-visible labels whose `~X~` markers must be unique. |

## Document Index

| # | Document | Description | Depends On |
|---|---|---|---|
| **AR** | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions AR-1…AR-29 | — |
| **RD-01** | [Translation engine and public API](RD-01-translation-engine-api.md) | Catalog schema, locale resolution, messages, formatting, diagnostics, replacement, browser-safe API | — |
| **RD-02** | [Catalog sources and validation](RD-02-catalog-sources-validation.md) | Async sources, secure Node JSON loader, strict validation, resource limits, provenance | RD-01 |
| **RD-03** | [Framework and application integration](RD-03-framework-application-integration.md) | Application injection, package catalogs, UI/Forms/Files/Datagrid migration, layout and accelerators | RD-01, RD-02 |
| **RD-04** | [Quality, documentation, and plugin governance](RD-04-quality-docs-plugin.md) | Official locales, review evidence, compatibility, performance, security matrix, docs and Codex plugin | RD-01, RD-02, RD-03 |

## Dependency Graph

```text
RD-01 Translation engine and public API
  ├── RD-02 Catalog sources and validation
  └── RD-03 Framework and application integration
        └── RD-04 Quality, documentation, and plugin governance
RD-02 ───────────────────────────────────────────────┘
```

## Suggested Implementation Order

| Phase | Documents | Description |
|---|---|---|
| **A: Foundation** | RD-01 → RD-02 | Port and harden the engine, schema, validation, and source boundary. |
| **B: Adoption** | RD-03 | Inject the service and migrate framework-owned strings and locale behavior. |
| **C: Release** | RD-04 | Complete reviewed catalogs, executable docs/plugin guidance, and full acceptance gates. |

## Key Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Ownership | JSVision-owned MIT-attributed port, no BlendSDK runtime dependency | Independent API lifecycle and zero runtime dependencies. |
| Runtime | Browser-safe main entry plus `@jsvision/i18n/node` | Prevent `node:*` imports from browser bundles. |
| Catalog shape | Locale-scoped schema 1 with string or one-level plural/select values | JSON-compatible, deterministic, and sufficient for v1. |
| Composition | Explicit locale subpath imports from each framework package | No global registry, circular dependency, or all-locale bundle cost. |
| Resolution | Locale-first, then layer priority, then mandatory English/default/key | A valid localized framework message is not suppressed by an English override. |
| Mutation | Copy-on-write per-locale `setCatalog()` runtime overlay | Preserves the accepted atomic replacement contract. |
| Diagnostics | Bounded structured records plus non-throwing optional sink | Development visibility without terminal corruption or data leakage. |

## Explicit Exclusions

- `@jsvision/code-editor` is tracked only by GitHub issue #184 and receives no requirement, plan
  task, or acceptance claim in this feature. *(AR #12)*
- Runtime locale switching, RTL layout guarantees, ordinals, nested/rich messages, key extraction,
  generated key types, file watching, built-in remote loading, and Theme Designer localization are
  outside v1. *(AR #7, AR #13, AR #16, AR #28)*
- BlendSDK `ContentFileSource` and its HTML/Markdown content use case are not ported because v1
  explicitly excludes HTML/rich messages. *(AR #7, AR #29)*

## How to Use These Documents

The four RDs form one implementation group. Create one feature plan that traces all four documents,
then execute specification tests before production code and verify each phase independently.
