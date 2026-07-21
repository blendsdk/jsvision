# Formatting & Cell Rendering Implementation Plan

> **Feature**: Locale-aware value formatting, a custom cell-renderer escape hatch, and value-driven conditional styling for `@jsvision/datagrid`
> **Status**: Planning Complete
> **Created**: 2026-07-13
> **Implements**: datagrid/RD-04
> **CodeOps Skills Version**: 3.7.0

## Overview

RD-04 governs how a cell *looks* when it is not being edited. A column stores a **typed value**
(`value(row)`, the sort/filter key) and paints a **display string** derived from it. This plan adds
three things on top of the value/format split that RD-01 already established:

1. A **formatter registry** (`fmt`) of pure, `Intl`-based factory functions — `number`, `currency`,
   `percent`, `date`, `datetime`, `boolean`, `enumLabel`, `lookupLabel` — where the three numeric kinds
   also ship a matched, tested **inverse `parse`** so an editable numeric column round-trips text → value.
2. A custom **cell renderer** (`GridColumn.render`) — the escape hatch for traffic-lights, badges, and
   glyph indicators — drawn into a cell-local, cell-clipped draw context with per-cell draw-error
   isolation.
3. Value-driven **conditional styling** (`GridColumn.cellStyle`) resolving a cell's colour by value,
   composited under a fixed precedence: **cursor > dirty > selected-row > cellStyle > zebra > normal**.

Built-in formatting needs no paint-path change — it already flows through the `toEngineColumn` string
accessor (`column.ts:120`). `render` and `cellStyle`, by contrast, require the datagrid body to paint
cells itself: `EditableGridRows` gains a self-contained `draw()` override (AR-1) that resolves each
cell's content and colour with the precedence above, keeping the existing cursor/dirty overpaints on
top. Every string a cell paints is already sanitized at the engine's buffer-write boundary
(`core/src/engine/render/buffer.ts:211`), so the security requirement (AC-5/AC-9) holds by construction
and the spec tests prove it.

The Should-Have conditional-format rules engine (data bars / icon sets / colour scales) is **deferred**
(AR-10, Phase B).

## Document Index

| #   | Document                                                | Description                                        |
| --- | ------------------------------------------------------- | -------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)          | Zero-Ambiguity Gate decisions (audit trail)        |
| 00  | [Index](00-index.md)                                    | This document — overview and navigation            |
| 01  | [Requirements](01-requirements.md)                      | Scope delta over RD-04                              |
| 02  | [Current State](02-current-state.md)                    | What exists in datagrid + the ui engine paint path |
| 03-01 | [Formatter Registry](03-01-formatter-registry.md)     | The `fmt` factories + matched inverse parsers      |
| 03-02 | [Cell Rendering & Styling](03-02-cell-rendering.md)   | `render`/`cellStyle`, precedence, draw-error isolation |
| 07  | [Testing Strategy](07-testing-strategy.md)              | Specification test cases (ST-*) and verification   |
| 99  | [Execution Plan](99-execution-plan.md)                  | Phases, sessions, and task checklist               |

## Quick Reference

### Usage Examples

```ts
import { column, fmt } from '@jsvision/datagrid';

interface Account { name: string; balance: number; }

const columns = [
  column({ id: 'name', title: 'Name', value: (r: Account) => r.name }),
  column({
    id: 'balance', title: 'Balance', align: 'right',
    value: (r: Account) => r.balance,
    // Display "€ 10.000,25"; a bad edit yields PARSE_FAILED (rejected at commit), never NaN.
    ...fmt.currency({ locale: 'nl-NL', currency: 'EUR' }),      // spreads { format, parse }
    set: (r, v) => { r.balance = v; },
    // Negative balances paint red via an explicit Style; a higher-precedence state
    // (cursor/dirty/selected) still wins. `Color` is `#hex | Ansi16Name | 'default'`.
    cellStyle: (v) => (v < 0 ? { fg: 'brightRed', bg: 'cyan' } : 'listNormal'),
  }),
  column({
    id: 'status', title: '', width: 3, value: (r: Account) => r.balance,
    // Traffic-light glyph via the custom renderer; ctx is cell-local and cell-clipped. The row bg was
    // already blanked in its role, so bg 'cyan' matches a normal row (read cell.state for other states).
    render: (ctx, cell) => ctx.text(0, 0, cell.value < 0 ? '●' : '○',
      { fg: cell.value < 0 ? 'brightRed' : 'brightGreen', bg: 'cyan' }),
  }),
];
```

### Key Decisions

| Decision                              | Outcome                                                       |
| ------------------------------------- | ------------------------------------------------------------ |
| Paint-path integration (AR-1)         | Self-contained `EditableGridRows.draw()` override; no ui change |
| Renderer-throw glyph + `cellStyle` red (AR-2) | Explicit `Style` (no semantic `danger` role exists); error `⚠` uses `gridDirty` fg over the row bg; semantic roles → RD-14 |
| `render` ctx (AR-3)                   | Cell-local, cell-clipped `DrawContext`                       |
| Invertible formatters (AR-4)          | number/currency/percent only; rest display-only              |
| `parse` contract (AR-13)              | `GridColumn.parse` widened to `(text)=>V \| PARSE_FAILED`; commit rejects the sentinel |
| Rules engine / data bars (AR-10)      | Deferred — Phase B                                           |

## Related Files

- **New:** `packages/datagrid/src/format.ts` (the `fmt` registry + inverse parsers),
  `packages/datagrid/src/cell-draw.ts` (cell-local ctx + draw-error isolation helper).
- **Modified:** `packages/datagrid/src/column.ts` (add `render?` / `cellStyle?` to `GridColumn`),
  `packages/datagrid/src/editable-grid-rows.ts` (the `draw()` override),
  `packages/datagrid/src/index.ts` (barrel exports).
- **New tests:** `format.spec.test.ts` / `format.impl.test.ts`,
  `cell-rendering.spec.test.ts` / `cell-rendering.impl.test.ts`, additions to `security.spec.test.ts`,
  a `datagrid` kitchen-sink story + smoke coverage.
