# Export & Layout Variants Implementation Plan

> **Feature**: Export the current grid view (CSV / HTML / JSON / TSV, with RFC-4180 quoting +
> CSV/TSV formula-injection escaping) and save/restore named layout **variants** (column order,
> widths, visibility, freeze, sort, filter) for `@jsvision/datagrid`.
> **Status**: Planning Complete
> **Created**: 2026-07-18
> **Implements**: datagrid/RD-13 (export + variants slice)
> **CodeOps Skills Version**: 3.9.0

## Overview

This plan builds the **export + personalization** slice of RD-13: a `grid.exportView(format)` that
serializes the current view — the visible columns in display order, `format`ted values, the
filtered + sorted rows — to CSV, HTML, JSON, or TSV; and `grid.saveVariant(name)` /
`grid.applyVariant(variant)` that round-trip the full column layout (order, widths, visibility,
freeze, sort, filter) as a caller-persisted `GridVariant`. Restoring freeze needs a new runtime
`setFrozen(left, right)` — today freeze is fixed at construction.

Two RD-13 areas are **deferred to a follow-up plan** ([AR-1](00-ambiguity-register.md)): CSV
**import / paste-append** (it couples to RD-08 `RowMutations` and RD-11's windowed no-op-insert
policy) and the **personalization Dialog** (a whole new UI surface). And **windowed-source row
export** is deferred to a post-RD-11 AR ([AR-2](00-ambiguity-register.md)): under RD-11 a windowed
`displayedRows()` is a lazy `Proxy` holding only the loaded window, so exporting a 100k-row view is a
genuinely different mechanism. **Variants are source-agnostic** and ship here regardless — they
serialize column/sort/filter *state*, never rows.

The work is spec-first and foundation-first: the pure serializer + the export method; then the freeze
mutator + the variant round-trip; then the kitchen-sink story, the showcase cluster, and the security
oracle. All new logic lands in two new modules (`export-view.ts`, `variant.ts`) with `grid.ts` holding
only thin method delegators, keeping it under its line guard (**< 1550** post-RD-11; re-based to ~1600
with rationale if the four documented methods cross it — [AR-15](00-ambiguity-register.md), PF-004).

> **Execution timing.** RD-11 has **landed** (windowed virtual scroll, merged on `feat/editable-data-grid`).
> The **execution-gate preflight refresh ran 2026-07-18** against RD-11's merged code — 4 major + 1 minor
> findings, all resolved and folded into the docs/tasks (see [`00-preflight-report.md`](00-preflight-report.md)).
> The plan is cleared to execute.

## Document Index

| #   | Document                                                                     | Description                                                        |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                               | Zero-Ambiguity Gate decisions (audit trail)                       |
| 00  | [Index](00-index.md)                                                         | This document — overview and navigation                           |
| 01  | [Requirements](01-requirements.md)                                           | Scope delta over RD-13                                             |
| 02  | [Current State](02-current-state.md)                                         | Grounded analysis of the code this plan builds on                 |
| 03-01 | [Exporter](03-01-exporter.md)                                              | `export-view.ts` pure serializer + `grid.exportView(format)`      |
| 03-02 | [Variants & freeze](03-02-variants-and-freeze.md)                          | `variant.ts` + `grid.setFrozen` + `saveVariant`/`applyVariant`    |
| 03-03 | [Showcase, barrel & security](03-03-showcase-barrel-and-security.md)       | Kitchen-sink story, showcase cluster, barrel exports, security oracle |
| 07  | [Testing Strategy](07-testing-strategy.md)                                   | Specification test cases (ST-1…ST-30) + verification              |
| 99  | [Execution Plan](99-execution-plan.md)                                       | Phases, sessions, task checklist (single source of truth)         |

## Quick Reference

### Usage Examples

```ts
import { EditableDataGrid, column, fromRows } from '@jsvision/datagrid';
import { signal } from '@jsvision/ui';

const grid = new EditableDataGrid({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });

// Export the current view (visible columns, formatted values, filtered + sorted rows):
const csv = grid.exportView('csv');   // RFC-4180, CRLF, '=SUM(A1)' → '=SUM(A1)
const html = grid.exportView('html'); // standalone <!doctype html> … <table> … 
const json = grid.exportView('json'); // [{ id: 1, name: 'Ann' }, …] — raw values, keyed by column id
const tsv = grid.exportView('tsv');   // tab-separated; caller pipes to setClipboard

// Save + restore a named layout variant (caller persists the returned object):
const mine = grid.saveVariant('mine');   // { name, columns, freeze, sort, filter }
grid.applyVariant(mine);                 // reproduces order/width/visibility/freeze/sort/filter
grid.setFrozen(['id'], ['actions']);     // runtime re-freeze (also used by applyVariant)
```

### Key Decisions

| Decision     | Outcome   |
| ------------ | --------- |
| Scope | All four exports + variants; import + personalization Dialog → follow-up ([AR-1](00-ambiguity-register.md)) |
| Source coupling | Eager sources now; windowed-source export → post-RD-11 AR; variants source-agnostic ([AR-2](00-ambiguity-register.md)) |
| Freeze in variants | Included — new runtime `setFrozen` ([AR-3](00-ambiguity-register.md)) |
| JSON form | Raw values keyed by column id ([AR-4](00-ambiguity-register.md)) |
| HTML form | Standalone minimal document ([AR-5](00-ambiguity-register.md)) |
| Export API | `grid.exportView(format)` method, not a free function ([AR-18](00-ambiguity-register.md)) |

## Related Files

- **New:** `packages/datagrid/src/export-view.ts`, `packages/datagrid/src/variant.ts`
- **Modified:** `packages/datagrid/src/grid.ts` (thin `exportView`/`saveVariant`/`applyVariant`/`setFrozen`
  delegators + `freezeSpec` → signal), `packages/datagrid/src/index.ts` (barrel: `ExportFormat`,
  `GridVariant`, `GridVariantColumn` types)
- **Tests:** `packages/datagrid/test/export-view.spec.test.ts`, `variant.spec.test.ts`,
  `export-view.impl.test.ts`, `variant.impl.test.ts`, additions to `security.spec.test.ts` and the
  datagrid-local `kitchen-sink.smoke.spec.test.ts`; and (PF-002) the showcase oracle
  `packages/examples/test/datagrid-showcase.smoke.spec.test.ts` (ST-6 `2→1`)
- **Showcase:** a new `packages/examples/datagrid-showcase/stories/export-personalization/` cluster
  (replaces the RD-13 placeholder in `stories/placeholders.ts`) + one kitchen-sink story in the
  **datagrid-local** registry `packages/datagrid/test/kitchen-sink/stories/` (PF-003)
