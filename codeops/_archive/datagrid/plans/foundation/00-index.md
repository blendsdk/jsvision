# Foundation & Grid-Engine Exposure — Implementation Plan

> **Feature**: `@jsvision/datagrid` foundation — the package scaffold + the load-bearing contracts (grid-engine promotion, `value`/`format`/`parse` column model + adapter, data-source + `rowKey`, commit sink, cell-overlay helper, a minimal read-only container, and an in-package story harness) that every later datagrid RD builds on.
> **Status**: Planning Complete
> **Created**: 2026-07-12
> **Implements**: datagrid/RD-01
> **CodeOps Skills Version**: 3.4.1

## Overview

`@jsvision/datagrid` is a new, ESM-only, zero-runtime-dependency monorepo package (`packages/datagrid`,
`private: true`) that layers an editable enterprise data grid on `@jsvision/ui`. This plan implements
**RD-01 only** — the substrate. Nothing here is a finished user feature; it is the set of interfaces
RD-02…RD-14 consume, so getting them right is the whole point of doing Foundation first.

The plan does two things at once. First it **promotes** `@jsvision/ui`'s already-shipped virtual-scroll/column
engine (`GridRows`/`GridHeader` + the pure `columns.ts` math) from source-internal to public API, so the new
package reuses it by name instead of reaching into `dist/`. Then it establishes the datagrid's own contracts:
the `GridColumn<T,V>` column model (whose typed `value` is the sort/filter key, whose `format` is the display
string, and whose `parse` is the edit round-trip), the `GridColumn → engine Column` adapter that makes "reuse
the engine" actually work, the two-tier `GridDataSource<T>` (in-memory `fromRows` + a windowed shape the body
is agnostic to), the `onCommit` veto sink plus a tested `commitCell` primitive, and the cell-aligned overlay
helper — all proven end-to-end by a minimal **read-only** `EditableDataGrid<T>` container and an in-package
kitchen-sink smoke test.

Per the plan-level gate: RD-01 ships a minimal read-only container (not substrate-only), keeps the story
harness inside the package, and includes both a per-column `column<T,V>()` authoring helper and the
`commitCell` primitive (AR #1–#3, plan).

## Document Index

| #   | Document                                                     | Description                                              |
| --- | ------------------------------------------------------------ | -------------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)               | Plan-level Zero-Ambiguity Gate decisions (8 items)       |
| 00  | [Index](00-index.md)                                         | This document — overview and navigation                  |
| 01  | [Requirements](01-requirements.md)                           | Scope delta over RD-01 + plan-local decisions            |
| 02  | [Current State](02-current-state.md)                         | Grounded analysis of the code RD-01 touches              |
| 03-01 | [ui Grid-Engine Promotion](03-01-ui-engine-promotion.md)   | Re-export `GridRows`/`GridHeader`/`columns.ts` + `@example`s |
| 03-02 | [Package Scaffold](03-02-package-scaffold.md)              | `packages/datagrid` workspace, tsconfigs, vitest, barrel |
| 03-03 | [Column Model & Adapter](03-03-column-model-adapter.md)    | `GridColumn`, `column`, `toEngineColumn`, `defaultCompare` |
| 03-04 | [Data Source & Commit](03-04-data-source-commit.md)       | `GridDataSource`, `fromRows`, `CellCommit`/`OnCommit`, `commitCell` |
| 03-05 | [Overlay & Read-only Container](03-05-overlay-container.md) | `mountCellOverlay`, read-only `EditableDataGrid<T>`      |
| 03-06 | [Story Harness](03-06-story-harness.md)                    | In-package story registry + headless smoke test          |
| 07  | [Testing Strategy](07-testing-strategy.md)                   | ST-1…ST-14 spec cases → AC-1…AC-10                        |
| 99  | [Execution Plan](99-execution-plan.md)                       | 6 phases, spec-first ordering, task checklist            |

## Quick Reference

### Usage Examples

```ts
import { signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';

interface Person { id: number; name: string; balance: number; }

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

// `column` infers V per column from `value`, so a typed `format`/`parse` (v is number) type-checks.
const columns = [
  column({ id: 'name', title: 'Name', value: (r: Person) => r.name }),
  column({
    id: 'balance',
    title: 'Balance',
    value: (r: Person) => r.balance,         // the numeric sort/filter key
    format: (v) => eur.format(v),            // "€ 1.000,00" — display only (v is typed number)
    parse: (t) => Number(t.replace(/[^\d.-]/g, '')), // edit round-trip
    align: 'right',
  }),
];

const rows = signal<Person[]>([
  { id: 1, name: 'Ada', balance: 1000 },
  { id: 2, name: 'Bo', balance: 9 },
]);

const source = fromRows(rows, { rowKey: (r) => r.id });
const grid = new EditableDataGrid<Person>({ columns, source }); // read-only in RD-01
// A numeric sort orders 9 before 1000 (never the "€ 9,00" / "€ 1.000,00" strings).
```

### Key Decisions

| Decision | Outcome | Ref |
| -------- | ------- | --- |
| RD-01 deliverable shape | Minimal read-only `EditableDataGrid<T>` container | AR #1 (plan) |
| Story harness home | In-package registry + local smoke test | AR #2 (plan) |
| Optional inclusions | per-column `column<T,V>()` **and** `commitCell` both in | AR #3 (plan) |
| Engine reuse | Adapt `GridColumn → engine Column`; promote engine from ui | req AR-12 / RD-01 §Column adaptation |
| Value vs display | Split `value`/`format`/`parse`; sort/filter key off `value` | req AR-31 |
| Row identity | Required `rowKey(row): string \| number` | req AR-15 |
| Commit contract | `onCommit` veto sink + `commitCell` primitive | req AR-16 / AR #3 (plan) |
| Overlay helper | Datagrid-owned public primitives, not `openAnchoredPopup` | req PF-004 / AR #7 (plan) |

## Related Files

**Created** (`packages/datagrid/`): `package.json`, `tsconfig.json`, `tsconfig.typecheck.json`,
`vitest.config.ts`, `README.md`, `src/index.ts`, `src/column.ts`, `src/data-source.ts`, `src/commit.ts`,
`src/overlay.ts`, `src/grid.ts`, plus `test/**` (spec/impl/e2e + the story harness + smoke test).

**Modified** (`packages/ui/`): `src/table/index.ts` and `src/index.ts` (add the engine re-exports, incl.
`stringWidth`), plus `src/table/grid-rows.ts`, `src/table/columns.ts`, and `src/controls/measure.ts` (add an
`@example` to each newly-public symbol).
