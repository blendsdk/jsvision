# Personalization Dialog Implementation Plan

> **Feature**: An end-user modal to reshape a grid's columns and manage saved layout variants
> **Status**: Planning Complete
> **Created**: 2026-07-18
> **Implements**: datagrid/RD-16
> **CodeOps Skills Version**: 3.8.0

## Overview

RD-07 gave the grid its column-layout **API** (show/hide, reorder, resize, freeze) and RD-13 added the
serializable **variant** API (`saveVariant`/`applyVariant`, `setFrozen`) — but both are *programmatic*:
only the app developer can call them. This plan puts a reusable modal `Dialog` on top of those APIs so
**end users** can toggle column visibility, reorder and freeze columns, set widths, and
save/apply/delete/default named layout **variants** at runtime — the terminal-native equivalent of SAP
ALV's *Change Layout / Manage Layouts*. It ships as one async helper, `personalizeGrid(grid, opts)`.

The dialog is **staged**: every edit mutates a *pending* `GridVariant` held by the dialog; **OK** commits
it to the grid in one pass via `grid.applyVariant(pending)`, **Cancel/Esc** discards it and leaves the
grid untouched. The grid stays stateless about persistence — the app supplies a `VariantStore` the dialog
reads and writes. Two small read/write additions to the grid make this buildable and correct: a public
reactive `grid.columns()` accessor, a `grid.defaultColumnLayout()` baseline for Reset, a
`grid.clearColumnWidth(id)` to return a column to auto width, and a **correction to `applyVariant`'s
width-restore** so a cleared width is actually removed (which also repairs a latent RD-13 round-trip bug).

The dialog composes existing `@jsvision/ui` widgets only (a sync `Dialog` + a `Scroller`-of-`Group`s column
list + `Input`/`Button`/`Text` controls with reactive `disabled`/content + nested `confirm()` prompts) —
**no** new engine, core, or reactive primitives — and the package stays zero-runtime-dependency.

## Document Index

| #   | Document                                                       | Description                                       |
| --- | -------------------------------------------------------------- | ------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                 | Zero-Ambiguity Gate decisions (plan-local)        |
| 00  | [Index](00-index.md)                                           | This document — overview and navigation           |
| 01  | [Requirements](01-requirements.md)                             | Scope delta over RD-16                             |
| 02  | [Current State](02-current-state.md)                           | Analysis of the current grid / variant / ui code  |
| 03-01 | [Grid Layout API](03-01-grid-layout-api.md)                 | `columns()`/`defaultColumnLayout()`/`clearColumnWidth()` + width-restore fix |
| 03-02 | [Variant Store](03-02-variant-store.md)                     | `VariantStore` seam + `createMemoryVariantStore()` |
| 03-03 | [Personalize Dialog](03-03-personalize-dialog.md)           | The dialog view + `personalizeGrid()` helper       |
| 03-04 | [Showcase, Barrel & Security](03-04-showcase-barrel-security.md) | Kitchen-sink story + showcase demo + security oracle + barrel |
| 07  | [Testing Strategy](07-testing-strategy.md)                     | Specification test cases (ST-*) and verification   |
| 99  | [Execution Plan](99-execution-plan.md)                         | Phases, tasks, checklist                           |

## Quick Reference

### Usage Examples

```ts
import { personalizeGrid, createMemoryVariantStore } from '@jsvision/datagrid';

const store = createMemoryVariantStore();            // app-owned; back it with a file/DB if you like

// Wire to a menu item / keybinding — the datagrid ships no default keybinding:
const { ok } = await personalizeGrid(grid, { store, host: app, title: 'Personalize columns' });
if (ok) {
  // the grid already reflects the user's chosen layout (committed via applyVariant)
}

// Apply a saved default on grid load — the app's job (the dialog only flags the default):
const def = store.getDefault();
if (def) {
  const variant = store.list().find((v) => v.name === def);
  if (variant) grid.applyVariant(variant);
}

// The new public read accessor (independently useful for app-built column UIs):
for (const c of grid.columns()) {
  // { id, title, visible, frozen: 'left'|'right'|'none', width }
}
```

### Key Decisions

| Decision | Outcome | AR |
| -------- | ------- | -- |
| Module layout | 3 new modules (`variant-store` · `personalize` · `personalize-dialog`); grid.ts thin delegators | AR-1 |
| `GridColumnInfo` / store name | `GridColumnInfo` in `variant.ts`; `createMemoryVariantStore()` | AR-2 |
| Width-restore signal | `clearWidths: string[]` in `ResolvedLayout`; `applyVariant` delete-then-set | AR-3 |
| grid.ts line guard | Thin delegators; re-base three `< 1680` guards (≈ `< 1760`) | AR-4 |
| Column list | `Scroller` over a `Group` of per-column composite rows (list widgets are text-only) | AR-5 |
| Freeze affordance | Per-row cycle `none → left → right` | AR-6 |
| Inputs | width `Input(maxLength:3, filter('0-9'))` + clamp-on-OK; name `Input(maxLength:64)` + `sanitize` | AR-7 |
| Dialog mechanism | Sync `PersonalizeDialog extends Dialog`; typed `result()`; no forms dep | AR-8 |
| Showcase | New `'Personalization'` category, one demo | AR-9 |
| Phasing | 4 phases | AR-10 |

## Related Files

**New** — `packages/datagrid/src/variant-store.ts`, `personalize.ts`, `personalize-dialog.ts`;
`packages/datagrid/test/{personalize,variant-store}.spec.test.ts` + `.impl.test.ts`;
`packages/datagrid/test/kitchen-sink/stories/personalization.story.ts`;
`packages/examples/datagrid-showcase/stories/personalization/personalize.story.ts`.

**Modified** — `packages/datagrid/src/grid.ts` (thin delegators + width-restore step),
`packages/datagrid/src/variant.ts` (`GridColumnInfo`, `clearWidths`), `packages/datagrid/src/index.ts`
(barrel), the three grid.ts line-guard tests, `variant.spec.test.ts`/`variant.impl.test.ts`
(width-restore + RD-13 regression), `packages/examples/datagrid-showcase/stories/index.ts` +
`packages/examples/test/datagrid-showcase.smoke.spec.test.ts` (category + counts).
