# Current State: Formatting & Cell Rendering

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The value/format/parse split and the engine adapter are already in place from RD-01; RD-02/RD-03 added
the editing lifecycle and cursor/dirty overpaints. This plan builds on all three.

- **`GridColumn<T,V>`** (`packages/datagrid/src/column.ts:21-48`) already carries `value`, optional
  `format?(value,row)`, `parse?`, `set?`, `width`, `align`, and `editor?`. It does **not** yet carry
  `render?` or `cellStyle?`.
- **`toEngineColumn`** (`column.ts:117-128`) adapts a typed column to the ui engine's string-accessor
  `Column<T>`: `accessor = format(value,row) ?? String(value)`, and a **value-aware** `compare` from
  `defaultCompare` (`column.ts:139-147`). So a numeric/currency column already orders by value, not by
  formatted text — this is the load-bearing seam behind AC-3.
- **`EditableGridRows.draw`** (`packages/datagrid/src/editable-grid-rows.ts:264-268`) calls
  `super.draw(ctx)` (the base paints all cells via the accessor), then overpaints `paintCursorCell`
  (`:330-355`) and `paintDirtyMarkers` (`:278-320`). The row-colour precedence lives in the base.
- **Base `GridRows.draw`** (`packages/ui/src/table/grid-rows.ts:184-237`) resolves each row's role
  (`listFocused` > `listSelected` > `staticText` zebra > `listNormal`, `:216-225`), blanks the row, then
  for each column draws `alignCell(col.accessor(row), width, align, stringWidth)` + a `│` divider.
- **`sanitize` is automatic.** `ScreenBuffer.text` runs `sanitize(str)` on every write
  (`packages/core/src/engine/render/buffer.ts:211`), and `DrawContext.text` routes through the buffer
  (`packages/ui/src/view/draw-context.ts`). No cell can emit a raw ESC/BEL regardless of the format or
  renderer output.
- **`makeDrawContext`** is exported on the ui barrel (`packages/ui/src/view/index.ts:20`) and builds a
  view-local, auto-clipped `DrawContext` over the shared buffer given a `viewRect` + absolute `clip`.
- **Theme roles.** `ThemeRoleName` is `keyof Theme` (`ui/src/view/types.ts:30`). `danger`/`warning`/
  `info`/`success` are **input aliases** (`ThemeColors`, `core/src/engine/color/aliases.ts:60-66`) that
  *colour* the generated roles — they are **not** roles you can name via `ctx.color(...)`. The only
  grid-specific roles are `gridCursor` / `gridDirty` (`core/src/engine/color/theme.ts:216,222`). A
  value-driven "danger red" therefore comes from an explicit `Style` (`{ fg, bg }`, e.g.
  `{ fg: 'brightRed', bg: 'cyan' }` — `Color` is `#hex | Ansi16Name | 'default'`), and a theme-adaptive
  red foreground is available as `ctx.color('gridDirty').fg`. `Style` and `ThemeRoleName` are on the ui
  barrel (`ui/src/index.ts:21,47`). *(Corrected by preflight PF-001; a dedicated semantic error role is
  RD-14 per RD-04 §Integration.)*
- **`CalendarDate`** + `toISO`/`parseISO`/`toDate` and `alignCell`/`stringWidth`/`ProgressBar` are on the
  ui barrel (`toDate` at `ui/src/index.ts:204`); `fmt.date` calls `toDate(calendarDate)`.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/datagrid/src/format.ts` | The `fmt` registry | **New** — factories + inverse parsers (AR-4…AR-8) |
| `packages/datagrid/src/cell-draw.ts` | Cell-local ctx + draw-error isolation | **New** — builds a cell-clipped ctx, runs `render` under try/catch (AR-2, AR-3) |
| `packages/datagrid/src/column.ts` | Typed column model | Add `render?(ctx,cell)` and `cellStyle?(value,row)` to `GridColumn`; **widen** `parse` to `(text) => V \| typeof PARSE_FAILED` (AR-13, PF-002) so `fmt.*` invertibles spread directly |
| `packages/datagrid/src/editable-grid-rows.ts` | Editable body paint | Replace `super.draw()` with a self-contained per-cell paint honoring precedence (AR-1). Set `topItem` via the protected `this.updateTop()` — `keepVisible`/`clampIndex` are module-private ui helpers, not reachable (PF-003) |
| `packages/datagrid/src/editing.ts` | Commit path | At the `tcol.parse!(field())` call (`editing.ts:263`), reject the commit when `parse` returns `PARSE_FAILED` — keep the editor open, write nothing (AR-13, PF-002) |
| `packages/datagrid/src/index.ts` | Public barrel | Export `fmt`, `PARSE_FAILED`, `NumberFormatOptions`, `CurrencyFormatOptions`, `CellRenderer`, `CellStyle`, `CellDrawContext`, `RenderCell` |
| `packages/datagrid/test/kitchen-sink/stories/*` | Showcase | Add a formatting story + smoke coverage |

### Code Analysis

`toEngineColumn.accessor` means `format` already reaches the frame with no new paint code — the built-in
`fmt` factories are pure functions the caller spreads into a column. The genuinely new paint work is
`render`/`cellStyle`, which the base loop cannot express (it paints a whole row in one role via the
string accessor, with no per-cell colour or content hook). Per AR-1 the datagrid body takes over the
per-cell paint.

## Gaps Identified

### Gap 1: No formatter registry
**Current Behavior:** callers hand-build `Intl.NumberFormat` and spread a `format` fn (see `column.ts`
JSDoc example); there is no shared, tested set of formatters and **no** inverse parser anywhere.
**Required Behavior:** `fmt.{number,currency,percent,date,datetime,boolean,enumLabel,lookupLabel}`; the
numeric three ship a matched, tested inverse (RD-04 R1–R3, AR-4…AR-8).
**Fix Required:** new `format.ts`.

### Gap 2: No per-cell content/colour hook
**Current Behavior:** every cell paints the string accessor in the row's single role. There is no way to
draw a glyph, a badge, or a value-driven colour.
**Required Behavior:** `render` (custom content, cell-local clipped ctx, draw-error isolated) and
`cellStyle` (value-driven colour under the fixed precedence) — RD-04 R4–R6.
**Fix Required:** `GridColumn` fields + a self-contained `EditableGridRows.draw()` override + `cell-draw.ts`.

### Gap 3: AC-3 value-aware ordering is unverified for a formatted column
**Current Behavior:** `toEngineColumn` synthesizes a value-aware comparator, but no test pins that a
**currency-formatted** column orders by the numeric value (9 before 1000), independent of the text.
**Required Behavior:** a spec test on the adapter comparator (RD-04 AC-3). Sorting the grid is RD-05;
this plan verifies only that the value/format split keeps ordering value-correct.
**Fix Required:** a spec test (no new production code — the adapter already exists).

## Dependencies

### Internal Dependencies
- RD-01 value/format/parse split + `toEngineColumn`/`defaultCompare` (`column.ts`).
- RD-02 cursor/dirty overpaints + precedence context (`editable-grid-rows.ts`).
- RD-03 `LookupItem` (reused by `fmt.lookupLabel`) and the typed widget editors (why date/boolean/enum/
  lookup need no text inverse — AR-4).

### External Dependencies
- None. `Intl.*` and the `@jsvision/ui`/`@jsvision/core` barrels only; `@jsvision/datagrid` stays
  zero-runtime-dependency.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| `draw()` override drifts from the base row-fill as the ui engine evolves | Med | Med | Keep the override minimal (only row-role + per-cell dispatch); reuse `alignCell`/`stringWidth`/`geometry()`; an impl test asserts the default (no render/cellStyle) path renders byte-identically to the base |
| `Intl` inverse parser is locale-fragile (PF-009) | Med | High | Restrict invertible kinds to number/currency/percent; assert `parse(format(v))===v` per supported locale in spec tests **for values representable at the configured fraction-digits** (PF-004 — `format` is lossy beyond its precision); a non-parseable string returns `PARSE_FAILED` (rejected at the commit path, AR-13; RD-12 layers richer validation later), never `NaN` |
| A cell-local ctx built per cell per frame adds paint cost | Low | Low | Only cells with a `render` hook build a sub-ctx; the default/`cellStyle` paths reuse the body ctx |
| Precedence regression vs RD-02 cursor/dirty overpaints | Med | High | Keep `paintCursorCell`/`paintDirtyMarkers` as the final overpaints; ST cases pin cursor>cellStyle and dirty-marker survival |
