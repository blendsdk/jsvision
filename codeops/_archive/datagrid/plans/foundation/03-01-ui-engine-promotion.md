# ui Grid-Engine Promotion: Foundation

> **Document**: 03-01-ui-engine-promotion.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 §"Grid-engine exposure from `@jsvision/ui`" · AC-2 · req AR-12

## Overview

Make `@jsvision/ui`'s already-shipped grid engine reachable **by name** from another package, additively.
Today only `DataGrid` + the column types are on the barrel; the renderers and the pure column math are
source-internal. This component re-exports them from the public barrel and pays the `check:docs` cost (an
`@example` on each newly-public value). No behavior, signature, or existing export changes.

## Architecture

### Current Architecture

`packages/ui/src/table/index.ts` re-exports `DataGrid` (from `data-grid.js`) + the types
`DataGridOptions`/`Column`/`ColumnWidth`/`ColumnAlign`/`SortState`/`ColumnGeometry` (from `data-grid.js`, which
itself re-exports the column types from `columns.js`). `packages/ui/src/index.ts:148-149` surfaces exactly
that. `GridRows`/`GridHeader` (`grid-rows.js`) and `apportionColumns`/`alignCell`/`sortRows`/`measureAutoWidths`
(`columns.js`) are `export`ed at their source files but stop there.

### Proposed Changes

Add the missing symbols to the internal table barrel, then to the package barrel — both as **explicit named
re-exports** (the ui convention). Add an `@example` to each newly-public class/function so `check-jsdoc.mjs`
passes.

## Implementation Details

### Promoted values (require an `@example`)

| Symbol | Source file | Kind |
| ------ | ----------- | ---- |
| `GridRows` | `table/grid-rows.ts` | class |
| `GridHeader` | `table/grid-rows.ts` | class |
| `apportionColumns` | `table/columns.ts` | function |
| `alignCell` | `table/columns.ts` | function |
| `sortRows` | `table/columns.ts` | function (kept per AR #8, plan) |
| `measureAutoWidths` | `table/columns.ts` | function |
| `stringWidth` | `controls/measure.ts` | function — the wide-glyph-aware measure `measureAutoWidths`/`alignCell` consume; a consumer MUST feed the SAME measure the engine draws with, so it is promoted alongside them (additive beyond AC-2's named set) |

### Promoted types (no `@example` needed)

`GridRowsConfig<T>` and `GridHeaderConfig<T>` (`grid-rows.ts:53,328`) — needed so a consumer can construct the
renderers. `Column`/`ColumnWidth`/`ColumnAlign`/`SortState`/`ColumnGeometry` are **already** on the barrel
(unchanged).

### Edits

1. **`packages/ui/src/table/index.ts`** — add:
   ```ts
   export { GridRows, GridHeader } from './grid-rows.js';
   export type { GridRowsConfig, GridHeaderConfig } from './grid-rows.js';
   export { apportionColumns, alignCell, sortRows, measureAutoWidths } from './columns.js';
   ```
2. **`packages/ui/src/index.ts`** — re-export the same value + type names from `./table/index.js` alongside
   the existing `DataGrid` line, **and** add `export { stringWidth } from './controls/measure.js';` so a
   consumer can feed `measureAutoWidths`/`alignCell` the exact wide-glyph-aware measure the engine draws with
   (explicit named re-exports, matching `:148-149`).
3. **`packages/ui/src/table/grid-rows.ts`** — add an `@example` to the `GridRows` and `GridHeader` class
   JSDoc (a short construct-and-mount snippet; the class docs already describe behavior).
4. **`packages/ui/src/table/columns.ts`** — add an `@example` to `apportionColumns`, `alignCell`, `sortRows`,
   `measureAutoWidths` (a pure input→output snippet each — these are deterministic helpers).
5. **`packages/ui/src/controls/measure.ts`** — add an `@example` to `stringWidth` (it becomes public; a
   short `stringWidth('ab') === 2` style snippet). `glyphWidth` stays internal (not promoted).

> **Documentation constraint (repo standard, NON-NEGOTIABLE):** the new `@example`s and any surrounding
> comments must be user/agent-facing — no CodeOps IDs, no TV/C++ provenance (`check-jsdoc.mjs` Check A bans
> them). Examples must be copy-paste-correct.

### Integration Points

- `@jsvision/datagrid` imports every promoted symbol by name (03-03…03-05).
- ui's own `DataGrid` continues to use `GridRows`/`GridHeader`/`columns.ts` internally — unchanged.

## Code Examples

### Example: the promoted engine consumed by name

```ts
import { GridRows, GridHeader, apportionColumns, alignCell, sortRows, measureAutoWidths, stringWidth } from '@jsvision/ui';
import type { Column, GridRowsConfig } from '@jsvision/ui';
// datagrid builds GridRowsConfig from adapted GridColumns (03-03) and constructs GridRows/GridHeader.
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `check:docs` fails: a promoted symbol lacks `@example` | Add the `@example`; the gate is the done-criterion for AC-2 | req AR-12 |
| A promoted `@example` trips a banned-reference rule | Rewrite in plain, user-facing language | repo docs standard |
| Promotion breaks an existing ui spec (api-stability / bundle-size / packaging) | Re-run ui's full suite as a regression gate; the change is additive, so a break signals a spec that must acknowledge the new surface | AC-2 (DataGrid unchanged) |

> **Traceability:** decisions here trace to req AR-12 (export the engine from ui) and AR #8 (plan; keep
> `sortRows`). Adding an `@example` to a public export is the repo's universal documentation rule, not a
> plan-specific choice.

## Testing Requirements

- Spec: a barrel-surface test importing each promoted value + type from `@jsvision/ui` and asserting it
  resolves (07 ST-1).
- Regression: ui's existing `DataGrid` export + tests remain green (07 ST-2).
- Gate: `yarn workspace @jsvision/ui check:docs` passes.
