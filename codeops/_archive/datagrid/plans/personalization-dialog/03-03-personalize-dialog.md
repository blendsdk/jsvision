# Personalize Dialog: Personalization Dialog

> **Document**: 03-03-personalize-dialog.md
> **Parent**: [Index](00-index.md)

## Overview

The end-user modal and its open helper: `personalizeGrid(grid, opts)` (public, `personalize.ts`) and the
internal `PersonalizeDialog extends Dialog` view (`personalize-dialog.ts`). Staged — edits mutate a
*pending* `GridVariant`; **OK** commits via `grid.applyVariant(pending)`, **Cancel/Esc** leaves the grid
untouched. Composes existing ui widgets only. Owns RD-16 AC#1–#4, #7, #8, #11, #12 and the Should-Have
count echo + mouse parity; the grid-side commit relies on [03-01](03-01-grid-layout-api.md), the
persistence on [03-02](03-02-variant-store.md).

## Architecture

### The open helper — `personalize.ts`

```ts
export interface PersonalizeOptions {
  readonly store: VariantStore;         // the variant store the dialog reads/writes
  readonly host: ModalDialogHost;       // the app's modal host (as formDialog/openFile use)
  readonly title?: string;              // default 'Personalize columns'
}
export interface PersonalizeResult { readonly ok: boolean; }

export function personalizeGrid<T>(grid: EditableDataGrid<T>, opts: PersonalizeOptions): Promise<PersonalizeResult>;
```

Mirrors `openFile` (`packages/files/src/openers.ts:60`) — **inline** the modal skeleton (`runDialog` is not
barrel-exported, [02](02-current-state.md)):
```ts
const dlg = new PersonalizeDialog(grid, opts);
opts.host.desktop.addWindow(dlg);
try {
  const command = await opts.host.loop.execView<string>(dlg);
  if (command === Commands.ok) { grid.applyVariant(dlg.result()); return { ok: true }; }
  return { ok: false };                                   // Cancel / Esc — grid untouched
} finally {
  opts.host.desktop.removeWindow(dlg);
}
```
`dlg.result()` returns the pending `GridVariant` (the openFile `result()` idiom). The commit is a single
`applyVariant` (AR-8): order + visibility + width + freeze + sort + filter in one pass.

### The dialog view — `personalize-dialog.ts`

`class PersonalizeDialog<T> extends Dialog` — a **sync** dialog (no `@jsvision/forms`): the base
`Dialog.valid()` close-gate (an invalid child vetoes the OK close and refocuses it — it does not grey the
OK button) + `okCancelButtons()` suffice (AR-8). The body is pinned `position: 'fill'` to avoid the
all-absolute-children width-collapse footgun (`form-dialog.ts:222-227`).

**Geometry** (PF-004): the dialog takes a fixed rect proportioned to `host.desktop.bounds` (à la
`FileDialog`) — the column-list `Scroller` occupies the upper region, the variants panel the lower, OK/
Cancel at the foot; the `Scroller` clips an oversized column list so the dialog fits a modest viewport.
The exact rect + region split is tuned at implementation (the smoke gate only asserts it paints).

**Pending model** (RD-16 §Pending model, AR-55/PF-025). On construction:
```ts
this.pending = grid.saveVariant('(current)');   // the ONE read of the live grid's sort/filter
```
`pending` is the single source of truth. The dialog holds working signals derived from it for the widgets
(a `Signal<GridColumnInfo[]>`-like working list keyed by id, a selected-row `Signal<number>`, a
name/width `Signal<string>` per the focused editors). Every edit rewrites `pending` (and the working
signals); the live grid is untouched until OK. **Applying a saved variant replaces `pending` wholesale**
(incl. its sort/filter) and re-renders the column list.

**Two regions** inside the fill body:
1. **Column list** — a `Scroller` over a `Group` of one composite row per column (AR-5), in `pending`
   order.
2. **Variants panel** — the store's `list()` with Save-as / Apply / Delete / Set-default + **Reset**.

OK / Cancel via `okCancelButtons()` at the dialog foot (Enter = OK on the `default:true` OK button; Esc =
Cancel via the base `Dialog` close path).

## Implementation Details — Column region

Each composite row (a `Group`, absolutely positioned within the scroller content) carries, left to right:

| Control | Widget | Behaviour |
| ------- | ------ | --------- |
| Visibility | a focusable toggle with a **reactive** `disabled` getter — a `Button`-based checkbox (`disabled: () => visibleCount()===1 && isVisible(col)`) or a small custom focusable `View`; **not** stock `Switch`, whose `disabled` is a non-reactive construction-time boolean | toggles `visible` in `pending`; **disabled when this is the last visible column** (PF-027 / PF-002) so a zero-visible layout can never be built (RD-16 AC#2). A reactive `Button.disabled` greys it *and* drops it from the Tab order |
| Title | `Text` | the column title (sanitized on render, though titles are app-trusted) |
| Freeze | a static-labelled focusable `Button` (or custom `View`) + adjacent reactive `Text(() => side)` | the button cycles `none → left → right → none` and writes the side into `pending.freeze`; the current side is shown by the reactive `Text` beside it, because a `Button`'s label is fixed at construction (PF-002) (RD-16 AC#4) |
| Width | `Input({ value, maxLength: 3, validator: filter('0-9') })` | digit-filtered live (empty allowed → auto: maps the pending width to `undefined`, clearing the override); a value sets `pending`'s width. The min/max **clamp lands on OK** via `applyVariant`'s `clampWidth` — **not** a `range()` OK-gate (its `isValid` rejects empty + out-of-range and would veto the OK close). (AR-7 / PF-001) |

**Row widgets are built once and driven by signals** (never rebuilt on edit): the visibility `disabled`
getter, the freeze-side `Text`, the width `Input`, and the count echo all react to `pending`/working-signal
changes in place, so keyboard focus is preserved across every edit (AC#11). Stock `Switch` and a
state-in-label `Button` are avoided precisely because their `disabled`/label state is fixed at construction
and would force a focus-destroying row rebuild (PF-002).

**Reorder** — the selected row moves with `Alt+↑` / `Alt+↓` and on-screen up/down `Button`s (RD-16 AC#3,
AR-51): a top row does not move up, a bottom row does not move down (boundary no-op). Reorder permutes
`pending.columns` (full order, hidden interleaved).

**Selection + keyboard** (RD-16 AC#11, AR-57): `↑`/`↓` move the list selection; `Space` toggles the
selected column's visibility (respecting the last-column guard); `Alt+↑`/`Alt+↓` reorder;
`Tab`/`Shift+Tab` move between controls/regions; `Enter` = OK; `Esc` = Cancel. Mouse parity is additive
(RD-16 Should-Have): clicking a toggle/button/row works alongside the keyboard, which is authoritative.

**Visible-count echo** (RD-16 Should-Have) — a `Text` reading e.g. `4 of 6 columns visible`, bound to the
pending visibility count, updates live.

## Implementation Details — Variants panel

- **The store list** — a `ListBox` of `store.list()` variant names (text-only rows are fine here — AR-5's
  gap is only about the *column* list). Selecting a variant is the target of Apply / Delete / Set-default.
- **Save-as** — a name `Input({ value, maxLength: 64 })` + a Save button. On save: `trim` → reject blank/
  whitespace-only (Save disabled or a rejection); `sanitize` the name; if `store.list()` already has that
  name → **nested `confirm(host, 'Overwrite "<name>"?')`** (yes → `store.save`; no → return to name entry,
  store unchanged). Save writes a `GridVariant` built from `pending` (every facet: columns/freeze/sort/
  filter — PF-025). Re-read `list()` after.
- **Apply** — `pending = { ...selectedVariant }`; re-render the column list. Unknown column ids are skipped
  by `applyVariant` on OK (RD-16 AC#8), not here.
- **Delete** — nested `confirm(host, 'Delete "<name>"?')` → `store.delete(name)`; deleting the default
  clears it (store side, PF-026). Re-read `list()`.
- **Set-default** — `store.setDefault(name)`; the grid layout does **not** change (no auto-apply, AR-50).
- **Reset** — restores `pending`'s **column facets** to `grid.defaultColumnLayout()` (all visible,
  construction order, no freeze, no width overrides); **leaves `pending`'s sort/filter untouched** (RD-16
  AC#6, PF-024/PF-025). On OK the corrected `applyVariant` clears any pre-Reset width override
  ([03-01](03-01-grid-layout-api.md)). **Mapping rule (PF-003):** rebuild the pending columns from
  `defaultColumnLayout()` with `width` **omitted** — the resolved `GridColumnInfo.width` is display-only;
  copying it back would re-set an override and defeat the clear.

**Nested modals** are safe — the ui modal stack is LIFO with saved-focus restore (`event/modal.ts:45-72`);
a `confirm()` opened from the dialog pushes a frame and pops back with focus restored (verified in recon).

## Code Examples

### Example 1: staged apply
```ts
const { ok } = await personalizeGrid(grid, { store, host: app });
// user hid 'note', froze 'id' left, set 'amount' width 18, pressed OK:
//   grid.columnOrder() excludes 'note'; grid.frozen().left includes 'id'; grid.columnWidth('amount') === 18
// had they pressed Esc: grid.columns() byte-identical to before the call
```

### Example 2: save the pending layout as a variant
```ts
// inside the dialog, after edits: Save-as 'compact' →
store.list().find((v) => v.name === 'compact');   // a GridVariant reflecting the pending columns/freeze/sort/filter
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| User hides the last visible column | The toggle is disabled at one-visible; zero-visible never committed | PF-027 / RD-16 AC#2 |
| Blank / whitespace-only variant name | Save rejected (nothing written) | RD-16 AR-56 |
| Save over an existing name | Nested confirm-overwrite; decline → store unchanged | RD-16 AR-49 |
| Delete a variant | Nested confirm; deleting the default clears it | PF-026 |
| Width below/above min/max | `filter('0-9')` blocks non-digits live (empty allowed); the corrected `applyVariant` clamps to `[minWidth,maxWidth]` on OK | RD-16 AC#5 / AR-7 / PF-001 |
| Variant name with control bytes | `sanitize` before echo/persist — no raw ESC/BEL reaches the frame; `maxLength:64` truncates at entry | RD-16 AC#12 / AR-56 / AR-7 |
| Apply a variant naming an absent column | Skipped by `applyVariant` on OK, not thrown | RD-16 AC#8 |
| Cancel/Esc | `execView` resolves non-OK; `applyVariant` never called → grid untouched | RD-16 AC#1 / AR-43 |
| All-absolute body collapses to width 0 | Body pinned `position: 'fill'` | — |

> **Traceability:** every strategy references its AR / RD AC / PF. See [00-ambiguity-register.md](00-ambiguity-register.md).

## Testing Requirements
- Helper: OK resolves `{ok:true}` + applies pending; Cancel/Esc resolves `{ok:false}` + grid byte-identical. ST-12.
- Column region (headless dispatched events): hide/show + last-column guard; reorder + boundaries; freeze cycle; width clamp/clear; Reset; keyboard-only operability; name sanitize + 64-cap. ST-13…ST-20.
- Variants panel: Save-as reflects pending + blank-reject + confirm-overwrite; Apply re-renders + reproduces on OK + carries sort/filter; Delete + confirm + default-clear; Set-default no-auto-apply. ST-21…ST-25.
