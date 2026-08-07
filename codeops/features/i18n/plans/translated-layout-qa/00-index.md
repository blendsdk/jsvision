# Translated layout and multilingual QA implementation plan
> **Implements**: i18n/REQ-LAYOUT-QA

> **Feature**: Shared translated-control geometry and multilingual QA kitchen sink
> **Status**: Planning Complete
> **Created**: 2026-07-26
> **CodeOps Artifact Schema**: 1

## Overview

This plan implements GitHub issue #185 after #184 completed Code Editor internationalization. It
adds one public, Unicode-correct button-group geometry contract to `@jsvision/ui`, migrates every
catalog-backed framework surface whose layout depends on translated text, and adds a registry-driven
multilingual QA application.

The QA supervisor reconstructs catalogs, `I18n`, `Application`, registry, and story state on every
locale transition. Automated coverage exercises all ten official locales at 80×24, declared narrow
boundaries, long application overrides, and wide/combining Unicode. RTL, caller-data translation,
mutable global locale, and human translation attestations remain outside scope.

## Document index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | Owning scope and acceptance criteria |
| 02 | [Current State](02-current-state.md) | Grounded implementation analysis |
| 03-01 | [Button Group Contract](03-01-button-group-contract.md) | Public metrics, composition, compatibility, and constraints |
| 03-02 | [Translated Surface Migration](03-02-translated-surface-migration.md) | UI, Forms, Files, Calendar, and Datagrid sweep |
| 03-03 | [Multilingual QA Harness](03-03-multilingual-qa-harness.md) | Registry, lifecycle, stories, and command |
| 03-04 | [Docs, Plugin, and Release](03-04-docs-plugin-release.md) | Consumer guidance and generated plugin synchronization |
| 07 | [Testing Strategy](07-testing-strategy.md) | Specification-first matrix and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Ordered task checklist |

## Quick reference

| Contract | Outcome |
|---|---|
| Shared width | Maximum of configured minimum and every button's natural terminal-cell width |
| Sibling equality | One measured width is applied across the complete logical action group, including wrapped rows |
| Overflow | Expand, then component-owned stable wrapping; explicit deterministic clipping only at infeasible/absolute bounds |
| Calendar | One localized display-cell geometry drives measure, draw, hit zones, and DatePicker popup sizing |
| Datagrid | Filter/personalization desired size includes all translated sections before viewport clamping |
| Locale switch | Dispose and reconstruct; preserve only validated locale/story identifiers |
| Official locales | `en`, `nl`, `de`, `fr`, `es`, `it`, `pt-PT`, `pl`, `ro`, `sv` |
| Verification | Focused package tests, docs/plugin checks, then authoritative `yarn verify` |

## Related paths

- `packages/ui/src/controls/`
- `packages/ui/src/dialog/`
- `packages/ui/src/date/`
- `packages/ui/src/editor/`
- `packages/forms/src/form-dialog.ts`
- `packages/files/src/dialog/`
- `packages/datagrid/src/`
- `packages/examples/src/`
- `packages/examples/test/i18n-layout.spec.test.ts`
- `packages/docs-site/`
- `tools/jsvision-skill/`
- `tools/jsvision-plugin-impact.json`
