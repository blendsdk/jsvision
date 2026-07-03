# Table / DataGrid Implementation Plan

> **Feature**: A focusable, virtual-scrolling multi-column `DataGrid<T>` for `@jsvision/ui` — a
> documented Turbo Vision extension on the `TListViewer` spine (heterogeneous columns, sticky header,
> click-to-sort, horizontal scroll).
> **Status**: Planning Complete
> **Created**: 2026-07-03
> **Implements**: jsvision-ui/RD-16
> **CodeOps Skills Version**: 3.1.0

## Overview

RD-16 adds the **tabular-data tier** to `@jsvision/ui`: a `DataGrid<T>` that renders rows of typed data
across multiple **heterogeneous columns** (each a different field), with a sticky header, per-column
sizing (`fixed`/`fr`/`auto`), click-to-sort, and horizontal scroll. Turbo Vision has **no** table class
— its only multi-column mechanism is `TListViewer::numCols`, a *newspaper-column flow of a single-field
list*. So the grid is a **documented TV-extension** (RD AR-151): the virtual-scroll spine, the `│`
divider, the `cpListViewer` row colours, and the `hScrollBar` indent are faithful to `TListViewer`; the
**header row + heterogeneous per-column accessors + sort** are the flagged extension.

Architecturally the grid follows the twice-shipped `Group = focusable-rows-renderer(View) + owned bar`
idiom (`ListView`, `Tree`): a `DataGrid<T>` `Group` composes a focusable multi-column `GridRows` view, a
non-scrolling sticky header, and **owned vertical + horizontal `ScrollBar`s**, reusing the RD-11
virtual-scroll helpers and the RD-02 integer `solveTrack` apportion. Zero new engine primitives; the only
additive surface is **one** new core theme role (`tableHeader`).

## Document Index

| #   | Document                                              | Description                                   |
| --- | ----------------------------------------------------- | --------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)        | Plan-time Zero-Ambiguity Gate (AR-172…AR-182) |
| 00  | [Index](00-index.md)                                  | This document — overview and navigation       |
| 01  | [Requirements](01-requirements.md)                    | Feature requirements and scope                |
| 02  | [Current State](02-current-state.md)                  | Reuse surfaces + TV source, verified          |
| 03-01 | [DataGrid & GridRows](03-01-data-grid.md)           | The `Group` container + the rows/header renderer (TV GATE-1 decode) |
| 03-02 | [Columns module](03-02-columns.md)                  | `Column<T>` types, width apportion, `auto` pre-measure, sort comparator |
| 03-03 | [Theme role & packaging](03-03-theme-packaging.md)  | The `tableHeader` core role, re-exports, story + demo |
| 07  | [Testing Strategy](07-testing-strategy.md)            | ST-1…ST-N spec oracles + verification         |
| 99  | [Execution Plan](99-execution-plan.md)                | Phases, sessions, task checklist              |

## Quick Reference

### Usage Example

```ts
import { signal } from '@jsvision/ui';
import { DataGrid, type Column } from '@jsvision/ui';

interface Person { name: string; age: number; city: string; }

const rows = signal<Person[]>([
  { name: 'Alice', age: 30, city: 'NY' },
  { name: 'Bob', age: 25, city: 'LA' },
]);

const columns: Column<Person>[] = [
  { title: 'Name', accessor: (p) => p.name, width: 'auto', maxWidth: 20 },
  { title: 'Age', accessor: (p) => String(p.age), width: 5, align: 'right', compare: (a, b) => a.age - b.age },
  { title: 'City', accessor: (p) => p.city, width: '1fr' },
];

const grid = new DataGrid<Person>({ rows, columns, command: 'personChosen', zebra: true });
// grid.focused / grid.selected / grid.sort are two-way signals; grid.sortBy(0, 'asc') drives sort.
```

### Key Decisions

| Decision                     | Outcome                                                              | AR |
| ---------------------------- | ------------------------------------------------------------------- | -- |
| Header colour                | New `tableHeader` role — white-on-cyan `0x3F`                        | AR-172 |
| `auto` sizing                | Widest over all current rows, `maxWidth`-or-uncapped, recompute-on-change | AR-173 |
| Grid layout                  | `[header 1][body fr][hbar 1]`, body `[rows fr \| vbar 1]`            | AR-174 |
| Should-Haves                 | All in: `sortBy()`, min/maxWidth, zebra                             | AR-175 |
| Zebra colour                 | Odd rows reuse `staticText` `0x70` (no new role)                     | AR-176 |
| Mouse select                 | Mirror `ListRows` (click focus+select, Enter/Space emit, dbl-click deferred) | AR-177 |

## Related Files

- **New:** `packages/ui/src/table/{data-grid,grid-rows,columns,index}.ts`
- **New:** `packages/ui/test/{datagrid,grid-columns,table.packaging}.{spec,impl}.test.ts`
- **New:** `packages/examples/kitchen-sink/stories/data-grid.story.ts` + `packages/examples/table-demo/`
- **Edited (additive):** `packages/core/src/engine/color/theme.ts` (the `tableHeader` role),
  `packages/ui/src/index.ts` (re-exports), `packages/examples/kitchen-sink/stories/index.ts`,
  `packages/examples/package.json` (`demo:table`)
