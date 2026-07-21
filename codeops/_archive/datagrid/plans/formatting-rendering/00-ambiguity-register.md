## Ambiguity Register: Formatting & Cell Rendering (datagrid/RD-04)

> **Status**: ✅ GATE PASSED — all 13 items resolved
> **Last Updated**: 2026-07-13 23:58
> **Feature**: datagrid · **Implements**: datagrid/RD-04 · **CodeOps Skills Version**: 3.7.0

RD-04 was authored through the make_requirements gate (AR-01…AR-32) and cleared the requirements
preflight (PF-001…PF-010, all applied). This register covers only the **new** architecture/naming
decisions this plan commits to that RD-04 left open. Items AR-1…AR-4 were resolved by an explicit
four-way structured choice (2026-07-13); AR-5…AR-12 by a single bulk acceptance of the recommended
resolutions (2026-07-13) — bulk acceptance is an explicit decision per the shared gate. The **plan
preflight** (2026-07-13, `00-preflight-report.md`) then **revised AR-2** (its premise that a `danger`
theme role exists was false — PF-001) and **added AR-13** (the `parse`-contract widening — PF-002);
both revised decisions were made by explicit user choice.

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Technical | How to integrate `render`/`cellStyle` into the paint path while honoring precedence (cursor>dirty>selected>cellStyle>zebra>normal); base `GridRows.draw` (`grid-rows.ts:184`) paints whole rows via the string accessor and is unaware of typed render/cellStyle | A: self-contained full `draw()` override in `EditableGridRows` (no ui change) · B: overpaint after `super.draw()` (precedence-fragile) · C: promote a per-cell paint hook into `@jsvision/ui` GridRows | ✅ Resolved — User chose **A** (self-contained full `draw()` override; no `@jsvision/ui` change) | ✅ Resolved |
| 2 | UX / Scope | AC-4 error glyph + `cellStyle` "danger red" — **no semantic error role exists, and `danger`/`warning`/`info`/`success` are `ThemeColors` input aliases (`aliases.ts:60-66`), NOT `Theme` roles** (the original register mis-stated them as roles — corrected by preflight PF-001; `ThemeRoleName = keyof Theme`). RD-04 §Integration assigns the error role to RD-14. | A′: self-contained (no core change) — `cellStyle` "red" returns an explicit `Style` `{fg,bg}`; the error glyph paints `⚠` in `{ fg: ctx.color('gridDirty').fg, bg: rowStyle.bg }`; defer semantic roles to RD-14 · B′: add semantic roles to the core `Theme` now (cross-package, preset + serialized-format + designer ripple — RD-14 scope) | ✅ Resolved — User chose **A′** (self-contained; explicit `Style` + `gridDirty` fg; no core change) — preflight PF-001, 2026-07-13 | ✅ Resolved |
| 3 | Integration | What draw context a custom `render(ctx, cell)` receives; `makeDrawContext` is on the ui barrel (`ui/src/view/index.ts:20`) so a real per-cell clip is feasible | A: cell-local, cell-clipped ctx (origin at cell top-left; writes past `cell.width` clipped) + `cell={x,y,width,value,row,state}` · B: body ctx + `cell` rect, renderer self-positions (no per-cell clip) | ✅ Resolved — User chose **A** (cell-local, cell-clipped ctx) | ✅ Resolved |
| 4 | Data / Scope | PF-009: which built-in formatters ship a matched inverse `parse` (text round-trip) vs display-only | A: number/currency/percent invertible; date/boolean/enumLabel/lookupLabel display-only (edited via RD-03 typed widgets, which commit the typed value directly) · B: also ship a date ISO text-parser · C: all formatters ship inverses | ✅ Resolved — User chose **A** (number/currency/percent invertible; rest display-only) | ✅ Resolved |
| 5 | Naming | `fmt` registry name and exported surface | `export const fmt = { number, currency, percent, date, datetime, boolean, enumLabel, lookupLabel }` — a namespace object of pure factory functions in a new `format.ts`; the invertible three return `{ format, parse }`, the rest a bare `format` fn | ✅ Resolved — User accepted recommendation | ✅ Resolved |
| 6 | Data | `fmt.datetime` input type (RD lists it but does not spec the input; `CalendarDate` is date-only) | `fmt.datetime` accepts a JS `Date` via `Intl.DateTimeFormat` (date+time); `fmt.date` accepts `CalendarDate`. Both display-only | ✅ Resolved — User accepted recommendation | ✅ Resolved |
| 7 | Naming | `enumLabel` / `lookupLabel` signatures | `enumLabel(labels: Record<string,string>)` → `v => labels[v] ?? String(v)`; `lookupLabel(items: LookupItem[])` → `v => items.find(i=>i.key===v)?.label ?? String(v)` (reuses RD-03 `LookupItem`). Display-only | ✅ Resolved — User accepted recommendation | ✅ Resolved |
| 8 | UX | `fmt.boolean` default labels | `fmt.boolean(labels?: {true:string; false:string})`, default `{ true: 'Yes', false: 'No' }`, overridable. Display-only | ✅ Resolved — User accepted recommendation | ✅ Resolved |
| 9 | Technical | `cellStyle` return type + precedence forward-compat (selected-row band is dormant until RD-08) | `cellStyle?(value,row): ThemeRoleName \| Style` (per RD); the plan implements the **full** precedence cursor>dirty>selected>cellStyle>zebra>normal now, so it is correct when RD-08 activates the selected band (selected stays inert until then) | ✅ Resolved — User accepted recommendation | ✅ Resolved |
| 10 | Scope | Should-Have conditional-format rules engine (data bars / icon sets / colour scales) | **Deferred (named)** — out of this plan (Phase B) | ⏸ Deferred — the Should-Have rules engine (data bars / icon sets / colour scales) · owner: datagrid feature-set · revisit: after RD-05 (sorting) + RD-06 (filtering) land | ⏸ Deferred |
| 11 | Naming | Verify command for every Verify line | `yarn verify` (per CLAUDE.md; `TUI_SKIP_PERF=1` locally, the bench never gates) | ✅ Resolved — User accepted recommendation | ✅ Resolved |
| 12 | Scope | Kitchen-sink story obligation (CLAUDE.md non-negotiable) | **In scope**: a `datagrid` story with a currency-formatted column + a conditional-style (`cellStyle`) column + a `render`-hook cell, passing the smoke test | ✅ Resolved — User accepted recommendation | ✅ Resolved |
| 13 | Technical / Data | PF-002: `fmt.*` invertible `parse` returns `V \| typeof PARSE_FAILED`, but `GridColumn.parse` is `(text)=>V` and the commit path writes the result unchecked (`editing.ts:263`) — the `...fmt.currency(...)` spread would not type-check and a sentinel could be persisted | A: keep `(text)=>V`, wire a per-column adapter (no failure channel in RD-04 scope) · B: widen `GridColumn.parse` to `(text)=>V \| typeof PARSE_FAILED` and reject the commit on the sentinel at `editing.ts:263` | ✅ Resolved — User chose **B** (widen + reject at commit) — preflight PF-002, 2026-07-13 | ✅ Resolved |

### Resolution Notes

**AR-1:** The self-contained override keeps the blast radius inside `@jsvision/datagrid` (RD-04 depends
only on RD-01), mirroring how RD-03 stayed additive over the RD-02 seam. `EditableGridRows.draw` will
reimplement the row/cell loop (resolve the row role, then per-cell: `render` → `cellStyle` → default
`accessor`+`alignCell`) and keep the existing `paintCursorCell` / `paintDirtyMarkers` overpaints on top.
The ~40 lines duplicated from the base row-fill are the accepted cost; the base loop is stable.

**AR-2 (revised — preflight PF-001):** The original note was **wrong**: `danger` is **not** a `Theme`
role, so `ctx.color('danger')` and `cellStyle → 'danger'` do not compile (`ThemeRoleName = keyof Theme`;
`danger`/`warning`/`info`/`success` are `ThemeColors` aliases that colour roles, `aliases.ts:60-66`). The
self-contained resolution: `cellStyle` "red" returns an explicit `Style` (e.g. `{ fg: 'brightRed',
bg: 'cyan' }` — `Color` is `#hex | Ansi16Name | 'default'`, so bare string literals need no import); the
renderer-throw glyph paints `⚠` in `{ fg: ctx.color('gridDirty').fg, bg: rowStyle.bg }` (a theme-adaptive
red composited over the row background, mirroring `paintDirtyMarkers`). A dedicated semantic error/`danger`
role is deferred to RD-14, where RD-04 §Integration already places it — no `@jsvision/core` change here.

**AR-13 (preflight PF-002):** `GridColumn.parse` widens to `(text) => V | typeof PARSE_FAILED`. Its only
consumer is the commit path (`editing.ts:263`), which now checks the sentinel: on `PARSE_FAILED` the
commit is rejected (the editor stays open, nothing is written), delivering AC-2 ("reported as invalid,
not `NaN`") within RD-04 and making the `...fmt.currency(...)` spread type-check directly. `isEditable`
(a `typeof parse === 'function'` test) is unaffected.

**AR-3:** A cell-local clipped context is built per cell from the body's paint pass. Because `render`'s
ctx clips to the cell rect, a custom renderer cannot overflow into a neighbouring column (this is what
carries AC-7 width-correctness through to custom renderers, not only the default `alignCell` path).

**AR-4:** RD-03 already supplies `DatePicker` / `CheckGroup` / `ComboBox` editors for date/boolean/enum/
lookup columns; those commit the typed value directly and never round-trip through text, so a text
inverse for those formatters would be dead surface. Only the text-edited numeric kinds
(number/currency/percent) need a matched, tested inverse (`parse(format(v)) === v` asserted per locale).

**AR-9:** The selected-row band exists in the base engine (`selected` signal) but the container pins it
to `-1` until RD-08; implementing the full precedence order now means RD-08 activates selection with no
paint-path retrofit.

**AR-10:** Deferred per the RD's own "Phase B" split (RD-04 §Should Have, AR-10). Downstream skills treat
this as Accepted Risk, not an open gap.
