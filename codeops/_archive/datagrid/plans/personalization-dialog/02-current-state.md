# Current State: Personalization Dialog

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Codebase-grounded analysis (read-only recon, 2026-07-18). Every claim carries a `file:line`.

## Existing Implementation

### What Exists

**The grid's layout write surface is complete; the read surface is thin.** `EditableDataGrid<T>`
(`packages/datagrid/src/grid.ts:302`, 1666 lines) already exposes `setColumnOrder`/`setColumnVisible`/
`setColumnWidth`/`autoFitColumn`/`frozen`/`setFrozen`/`saveVariant`/`applyVariant`. The private layout
state is: `columnOrderSig` (full order incl. hidden, `:378`), `columnWidths` (override map, starts empty
`:379`), `hidden` (set, starts empty `:380`), `freezeSpecSig` (`:383`), plus the construction-order
carriers `engineCols` (`:393`, holds each column's declared `width`), `columnIndex` (`:394`), and the
typed `columnMap` (`:399`, holds `minWidth`/`maxWidth`). Construction order and declared widths are
therefore recoverable at runtime with **no new stored state**.

**The variant round-trip exists but its width-restore is one-directional.** `variant.ts` (171 lines)
defines `GridVariant`/`GridVariantColumn` and the pure `buildVariant`/`resolveVariant`; `grid.saveVariant`
(`:1148`) / `grid.applyVariant` (`:1173`) delegate to them. RD-13 shipped this.

**The ui modal + widget toolkit exists.** `ModalDialogHost` (`packages/ui/src/dialog/message-box.ts:22`),
`confirm(host, text)` (`:132`), `Dialog` + `okCancelButtons()` (`dialog/dialog.ts`, `dialog/buttons.ts:88`),
`Scroller` (`scroll/scroller.ts:35`), `Input` (`controls/input.ts:33`, with `maxLength` + `validator`),
`Switch`/`CheckGroup`/`Button`, and `filter`/`range` validators — all on the ui barrel. `formDialog`
(`packages/forms/src/form-dialog.ts:194`) and `openFile` (`packages/files/src/openers.ts:60`) are the
async-modal helper templates.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/datagrid/src/grid.ts` | The grid class | + thin delegators `columns()`/`defaultColumnLayout()`/`clearColumnWidth()`; correct the `applyVariant` width step (`:1187-1192`) |
| `packages/datagrid/src/variant.ts` | Variant types + pure logic | + `GridColumnInfo` type; + a pure `buildColumnInfos(...)` helper; + `clearWidths` on `ResolvedLayout`; `resolveVariant` populates it; a pure `defaultLayout(...)` snapshot helper |
| `packages/datagrid/src/variant-store.ts` | **NEW** | `VariantStore` interface + `createMemoryVariantStore()` |
| `packages/datagrid/src/personalize.ts` | **NEW** | `personalizeGrid()` + `PersonalizeOptions`/`PersonalizeResult` |
| `packages/datagrid/src/personalize-dialog.ts` | **NEW** | internal `PersonalizeDialog extends Dialog` |
| `packages/datagrid/src/index.ts` | Barrel | + `personalizeGrid`, `createMemoryVariantStore` (values, need `@example`); `VariantStore`/`GridColumnInfo`/`PersonalizeOptions`/`PersonalizeResult` (types) |
| `packages/datagrid/test/grid-{footer,selection}.impl.test.ts`, `navigation.impl.test.ts` | Line guards | re-base `< 1680` → projected final (AR-4) |
| `packages/examples/datagrid-showcase/stories/index.ts` + `packages/examples/test/datagrid-showcase.smoke.spec.test.ts` | Showcase registry + oracle | + `'Personalization'` category (ST-5) + one count line (ST-7) |

### Code Analysis — the two things that must change in shipped code

**`applyVariant` never clears a width (`grid.ts:1187-1192`):**
```ts
const widths = new Map(this.columnWidths());        // seeds from CURRENT overrides
for (const [id, width] of resolved.widthById) {     // widthById = named cols WITH a width only
  const col = this.columnMap.get(id);
  if (col !== undefined) widths.set(id, clampWidth(width, col.minWidth, col.maxWidth));
}                                                    // → a named col WITHOUT a width keeps its stale override
this.columnWidths.set(widths);
```
`resolveVariant` (`variant.ts:159`) builds `widthById` from `named.filter((c) => c.width !== undefined)`,
so it carries no "unset" signal. The fix (AR-3): `resolveVariant` also returns
`clearWidths` = named columns *without* a `width`; `applyVariant` `widths.delete(id)` for each before
setting the rest.

**No `columns()` accessor.** The nearest public read is `columnOrder()` (`:1020`) → `visibleIds()`
(visible-only). The dialog needs the full list including hidden, with resolved freeze + width — assembled
by a new pure `buildColumnInfos(order, hidden, frozen, widthOf, titleOf)` in `variant.ts`, delegated to by
a thin `columns()` on the grid.

## Gaps Identified

### Gap 1: No public column-metadata accessor (the RD-13 plan's Gap 1)
**Current:** `columnMap` is `private` (`grid.ts:399`); the dialog cannot read column metadata.
**Required:** a reactive `grid.columns(): readonly GridColumnInfo[]` (full order, hidden included).
**Fix:** [03-01 §columns()](03-01-grid-layout-api.md).

### Gap 2: No Reset baseline, no width-clear
**Current:** no way to read the construction-time layout, and `setColumnWidth` only *sets*.
**Required:** `grid.defaultColumnLayout()` and `grid.clearColumnWidth(id)`.
**Fix:** [03-01 §defaultColumnLayout / §clearColumnWidth](03-01-grid-layout-api.md).

### Gap 3: `applyVariant` cannot remove a width override
**Current:** width overrides are additive-only (`grid.ts:1187-1192`) → a staged "no width" layout can't be
committed; a cleared width silently persists (a latent RD-13 bug).
**Required:** the delete-then-set correction, with an RD-13 round-trip regression test.
**Fix:** [03-01 §applyVariant width-restore](03-01-grid-layout-api.md).

### Gap 4: List widgets are text-only
**Current:** `ListView`/`ListBox` render `getText(item)` only (`list/list-rows.ts:235-236`) — no per-row
controls.
**Required:** a column list where each row hosts a visibility toggle + width input + freeze control +
reorder buttons.
**Fix:** a `Scroller` over a `Group` of composite rows (AR-5) — [03-03 §Column region](03-03-personalize-dialog.md).

## Dependencies

### Internal
- `grid.ts` public API (RD-07/RD-13): `saveVariant`/`applyVariant`/`setFrozen`/`columnOrder`/`frozen`/`columnWidth` + the new `columns()`/`defaultColumnLayout()`/`clearColumnWidth()`.
- `variant.ts` pure logic; `column-model.ts` `clampWidth`/`partition` (already barrel-exported).
- ui: `Dialog`, `okCancelButtons`, `Commands`, `confirm`, `Scroller`, `Input`, `Text` (reactive getter), `Button` (reactive `disabled`), the `filter` validator, `signal`; type `ModalDialogHost`. core: `sanitize`. (Not stock `Switch` or the `range` validator — their construction-time `disabled`/validation don't fit the per-row reactive state or the clamp-on-OK width field; PF-001/PF-002.)

### External
- None. `packages/datagrid/package.json` already deps `@jsvision/core` + `@jsvision/ui` (`:55-58`); no new dependency (`check:deps` stays green).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| The `applyVariant` correction regresses RD-13 variant round-trips | Med | High | Spec-first: an RD-13 round-trip regression case in `variant.spec.test.ts` (AR-12) before the fix; the correction is scoped to **named** columns only (unnamed keep their state) | 
| grid.ts breaches its `< 1680` guard | High | Low | Assembly logic in pure `variant.ts` helpers; grid.ts grows by ~4 thin delegators only; re-base the three guards (AR-4) |
| An all-absolute-children dialog body collapses to width 0 | Med | Med | Pin the body `position: 'fill'` (the `formDialog` footgun, `form-dialog.ts:222-227`); a datagrid memory notes the same collapse |
| A nested `confirm()` mis-focuses on close | Low | Med | The ui modal stack is LIFO with saved-focus restore (`event/modal.ts:45-72`) — verified safe; assert focus return in an impl test |
| Examples tests assert against stale `dist` | Med | Med | Rebuild `@jsvision/datagrid` before the showcase tests (examples import the built dist by name) |
