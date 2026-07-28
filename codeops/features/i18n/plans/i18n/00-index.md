# I18n implementation plan

> **Implements**: i18n/RD-01, i18n/RD-02, i18n/RD-03, i18n/RD-04
> **Status**: Draft
> **Created**: 2026-07-25
> **CodeOps Artifact Schema**: 1

## Outcome

Ship a JSVision-owned `@jsvision/i18n` package, integrate its exact service instance into
`Application` and the UI/Forms/Files/Datagrid packages, publish ten explicit locale families, and
teach the canonical JSVision Codex skill how to create and validate localized applications.

This is a substantial MIT-licensed port of concepts and suitable tests from `@blendsdk/i18n`, not a
runtime dependency or a literal package copy. The package-level notice preserves upstream
attribution.

## Planning group

| Requirement | Specification | Primary verification |
|---|---|---|
| RD-01 | [03-01-engine-and-catalog.md](03-01-engine-and-catalog.md) | ST-01–ST-16 |
| RD-02 | [03-02-sources-and-security.md](03-02-sources-and-security.md) | ST-17–ST-29 |
| RD-03 | [03-03-framework-integration.md](03-03-framework-integration.md) | ST-30–ST-43 |
| RD-04 | [03-04-locales-docs-plugin.md](03-04-locales-docs-plugin.md) | ST-44–ST-55 |

## Documents

| Document | Purpose |
|---|---|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Resolved planning decisions |
| [01-requirements.md](01-requirements.md) | Requirement boundary and deltas |
| [02-current-state.md](02-current-state.md) | Grounded repository and upstream analysis |
| [03-01-engine-and-catalog.md](03-01-engine-and-catalog.md) | Browser-safe engine design |
| [03-02-sources-and-security.md](03-02-sources-and-security.md) | Async and Node source design |
| [03-03-framework-integration.md](03-03-framework-integration.md) | Application/package integration |
| [03-04-locales-docs-plugin.md](03-04-locales-docs-plugin.md) | Locale, docs, review, and plugin design |
| [07-testing-strategy.md](07-testing-strategy.md) | Independent acceptance oracle |
| [99-execution-plan.md](99-execution-plan.md) | Specification-first implementation sequence |

## Release boundary

The engine, integrations, documentation, and draft catalogs may be implemented and verified before
translation review. RD-04 and the release phase remain incomplete until each non-English catalog
digest has a method-disclosed approval recorded in the checked review manifest.
