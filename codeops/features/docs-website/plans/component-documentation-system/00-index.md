# Plan: Component Documentation System

> **CodeOps Artifact Schema**: 1
> **Implements**: docs-website/RD-05
> **Feature**: docs-website · **Phase**: B (Coverage)
> **Status**: Approved — preflight passed on 2026-07-29 after a bounded iteration-3 verification
> **CodeOps Skills Version**: 3.3.2

Apply the richer `component-page-template1` and `template1` contracts across JSVision's complete public
visual component surface. The plan adds a machine-readable catalog, fills missing pages/sidebar
coverage, rebuilds every older component example except the completed Button/Input/Text references,
and replaces the old Data Grid and Code Editor content with dedicated multi-page specialist hubs.

## Documents

| Document | Purpose |
|---|---|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate; AR-1…AR-20 resolved. |
| [01-requirements.md](01-requirements.md) | Thin planning delta and RD-05 acceptance mapping. |
| [02-current-state.md](02-current-state.md) | Source-backed page, example, sidebar, API-map, and public-surface inventory. |
| [03-01-catalog-and-navigation.md](03-01-catalog-and-navigation.md) | Catalog schema, validation, sidebar projection, and API-map relationship. |
| [03-02-page-and-example-contract.md](03-02-page-and-example-contract.md) | Executable page backbone and `template1` runtime contract. |
| [03-03-standard-component-migration.md](03-03-standard-component-migration.md) | Exact standard routes/examples and family migration waves. |
| [03-04-data-grid-hub.md](03-04-data-grid-hub.md) | Twelve-page Data Grid hub and 24 focused examples. |
| [03-05-code-editor-hub.md](03-05-code-editor-hub.md) | Eleven-page Code Editor hub and 21 focused examples. |
| [03-06-overview-links-and-quality.md](03-06-overview-links-and-quality.md) | Overview, related/API links, review gate, and stale-route audit. |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-1…ST-32 specification oracle and red/green protocol. |
| [99-execution-plan.md](99-execution-plan.md) | Twelve spec-first execution phases with bounded file tasks. |

## Scope at a Glance

| Area | Planned result |
|---|---|
| Standard components | Approximately 48 primary documentation units across foundations, shell, controls, containers, feedback, date, color, surface, editing/output, forms, and files. |
| Existing references | Button, Input, and Text retained as the completed reference implementations. |
| Existing examples | Form Dialog, List Box, File Dialog, and old Data Grid example rebuilt/replaced; all future standard examples use `template1`. |
| Missing content | New pages/examples for shell/spine, Multi-check Group, List View, Split View, Surface, Indicator, and the composable file family. |
| Data Grid | 12-page specialist hub; 24 focused docs examples adapted from 67 shipped showcase stories. |
| Code Editor | 11-page specialist hub; 21 capability-selected docs examples adapted from 20 ordinary and 11 QA source scenarios. |
| Governance | `components.json`, structural/parity specs, sidebar/API validation, no Coming Soon on cataloged targets. |
| Removed content | Old `/components/table/data-grid` and `/guide/code-editor` pages/routes. |

## Key Decisions

- Cover public user-facing visual components and major application surfaces, not every helper/type/
  algorithm/controller/engine export (AR-2).
- Use the user-approved page and example directives everywhere (AR-4/5).
- Give Data Grid and Code Editor dedicated prefix-specific hubs (AR-6/7/8/17).
- Keep docs examples independent from showcase/demo registries (AR-9).
- Use a machine-readable catalog without invented maturity badges (AR-10/11).
- Permit anchored ownership for tightly coupled public subcomponents and deliberate example sharing
  without weakening primary-page coverage (AR-18/19).
- Keep runnable source identity and essence-only Markdown snippets separate (AR-20).

## Verification

Focused docs-site checks during each phase; `yarn verify` is the authoritative final gate.
