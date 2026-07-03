# Current State: Tabs (`TabView`)

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

RD-17 is **net-new UI** but reuses only shipped facilities — no new engine primitive. Everything the
`TabView` needs is already in `@jsvision/core` + `@jsvision/ui` and is exercised by the RD-11/15/16
container tier. There is **no Turbo Vision counterpart** to decode (GATE-1, AR-172): TV had no
tab/notebook/tabstrip class. The plan therefore transcribes shipped *pieces* (glyph shapes, tilde
hotkeys, disabled greying, `cpAppColor` colour), not a TV class.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/ui/src/list/list-view.ts:43` | `ListView<T> extends Group` — the container idiom (AR-169): a `Group` composing a focusable renderer + owned chrome | **Reference pattern** — `TabView` mirrors it |
| `packages/ui/src/tree/tree.ts:50`, `table/data-grid.ts:62`, `scroll/scroller.ts:62` | Same `extends Group` idiom | Reference |
| `packages/ui/src/list/list-rows.ts:78`, `table/grid-rows.ts:91`/`:353` (`GridHeader`) | The renderer-split `View` (`ListRows`/`GridRows`/`GridHeader`) | **Reference** — `tab-strip.ts` mirrors this split |
| `packages/ui/src/table/grid-rows.ts:424` (`GridHeader.onEvent`) | Maps `local.x` (+ H-indent) → column and toggles sort on click | **Closest hit-test precedent** for the strip's label/×/arrow hit-testing |
| `packages/ui/src/view/group.ts:104` (`addDynamic`) | Reactive child-producer factories built + started at mount | Reuse — add the eager page `Group`s + the strip as children |
| `packages/ui/src/view/reflow.ts:68-70` (`visible:false` → null rect) + `View.state.visible` (`view.ts:47`) | A hidden view (and its subtree) is omitted from layout | **Reuse** — bind each page's `state.visible` to `active` via a reactive `effect`; one page visible at a time, all pages stay mounted (state preserved). **Not** `Show` — it **disposes** the inactive branch (`reactive/show.ts:33-37`), losing page state |
| `packages/ui/src/menu/builders.ts:61`/`:80` (`parseTilde`/`tildeSegments`) | `~X~` hotkey parse + segment render (already reused by `Label`) | Reuse — tab titles + Alt-hotkey |
| `packages/ui/src/window/frame.ts:78-94` (`SINGLE_BORDER`, `drawBorder`) | The single-line box glyph set + border draw — **module-private**, ships no tee | **Not edited** (PA-2): tabs define a local glyph set with the same code points + the added tees |
| `packages/core/src/engine/color/theme.ts:16-22` (`ThemeRole`), `:86` (`clusterDisabled` `0x38`), `:154`/`:296` (`tableHeader` extension role) | The theme model + the disabled-greying precedent + the `tableHeader` additive-extension-role precedent | **Additive edit** — +3 `tab*` roles |
| `packages/core/src/engine/input/keys.ts:57-69`/`:187-192` | `TILDE_KEYS` (PageUp/Down = `CSI 5;5~`/`CSI 6;5~`) + `classifyCsi` modifier decode | Reuse — the decoder already produces `{pageup/pagedown, ctrl:true}` |
| `packages/ui/src/event/dispatch.ts:114-128` | Command/keymap consume runs **before** built-in Tab traversal | Reuse — `TabView` consumes its nav chords before focus-Tab sees them |
| `packages/examples/kitchen-sink/story.ts:37-56` | The `Story` contract | Reuse — add `tabs.story.ts` |
| `packages/examples/package.json:24-26` | `demo:containers`/`demo:tree`/`demo:table` scripts | **Add** `demo:tabs` |

### Code Analysis

- **Container idiom (AR-169).** `class ListView<T> extends Group` composes a focusable `ListRows<T>
  extends View` + an owned `ScrollBar`, exposing `rows` as the focus target. `TabView` follows this
  exactly: a `Group` composing a focusable `TabStrip extends View` + the content region, one page shown
  via a reactive `state.visible` binding keyed on `active` (not `Show`, which would dispose the inactive
  pages — `show.ts:33-37`).
- **Renderer split keeps the container ≤500.** `GridRows`/`GridHeader` split the draw + hit-test out of
  `data-grid.ts`. `tab-strip.ts` is the same move — it owns the notched-label draw, the `◄`/`►` arrows,
  the per-tab `×`, and the click→(tab/close/arrow) hit-test, so `tab-view.ts` stays ≤500 (PA-4).
- **Hit-test precedent.** `GridHeader.onEvent` (`grid-rows.ts:424`) reads `ev.local.x`, maps it through
  the H-indent to a column, and toggles sort. The strip's hit-test is the same shape: map `ev.local.x`
  (+ overflow scroll offset) to a tab index, then decide label vs. `×` vs. `◄`/`►` by the sub-column.
- **Nav ordering is already correct.** `dispatch.ts:114-128` consumes keymap/command matches before the
  built-in Tab/Shift-Tab focus traversal — so a `TabView` that consumes Ctrl+PageUp/Down (and `←→` when
  its strip is focused) will switch tabs, while plain Tab still falls through to content-focus traversal.
- **Ctrl+PageUp/Down already decodes.** `keys.ts` classifies `CSI 5;5~`/`CSI 6;5~` → `{key:'pageup'|
  'pagedown', ctrl:true}` today — the reliable global switch chord (AR-183). Ctrl+Tab does **not**
  disambiguate from plain Tab without the (unshipped, DEF-2) keyboard protocol.
- **Disabled greying is a colour swap.** `clusterDisabled` (`theme.ts:86`, `0x38`) is the shipped
  disabled convention; the `tabDisabled` role plays the same part for tab labels.

## Gaps Identified

### Gap 1: No tab / notebook container
**Current Behavior:** Multi-panel content requires several `Window`s or a hand-composed layout.
**Required Behavior:** A single `TabView` packs titled pages in one framed region, one visible at a time.
**Fix Required:** New `src/tabs/` subsystem (`tab-view.ts` + `tab-strip.ts` + `index.ts`).

### Gap 2: Frame glyph set has no tee and is private
**Current Behavior:** `SINGLE_BORDER` (`frame.ts:78-85`) is module-private and ships only corners/edges
(`┌┐└┘│─`), no `┬┴├┤`.
**Required Behavior:** Folder-tab chrome needs the tab-junction tees to notch labels into the frame.
**Fix Required:** A **local** glyph set in `src/tabs/` with the identical Unicode code points **plus**
the freshly-decoded tees `┬ ┴ ├ ┤` (U+252C/2534/251C/2524) — no edit to `frame.ts` (PA-2).

### Gap 3: No `tab*` theme roles
**Current Behavior:** `Theme` has no tab colours.
**Required Behavior:** `tabActive` / `tabInactive` / `tabDisabled`, `cpAppColor`-decoded, exact bytes.
**Fix Required:** Additive edit to `theme.ts` + `defaultTheme` (same pattern as `tableHeader`, PA-3).

## Dependencies

### Internal Dependencies
- RD-01 reactive core (`signal`/`computed`/`effect`; the page-switch is a reactive `visible` binding,
  not `Show`), RD-02 layout, RD-03 view/group spine
  (`Group`/`View`/`DrawContext`/`bind`/`invalidate`), RD-04 event loop (focus chain, keymap/commands,
  mouse hit-test), RD-05 app shell (`parseTilde`/`tildeSegments`, disabled-greying convention, `Window`/
  `Dialog` hosts), `@jsvision/core` theme.

### External Dependencies
- None. Zero runtime deps; `yarn check:deps` must continue to pass.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| `tab-view.ts` exceeds 500 lines | Med | Low | Renderer split into `tab-strip.ts` from the start (PA-4); barrel `index.ts` |
| Ctrl+Tab expectation regresses (false-green) | Low | High | AC-4 feeds **real decoder bytes** (`CSI 6;5~`); Ctrl+Tab asserted only behind the capability flag (AR-183) |
| Overflow auto-scroll off-by-one clipping | Med | Med | ST-cases for overflow (keep-active-visible + clip) derived from AC-9; impl tests for edges |
| GATE-1 tee/colour decode drift | Low | Med | BEFORE/AFTER GATE tasks in `99-execution-plan.md`; decode recorded in code JSDoc + commit |
| Empty / all-disabled indexing crash | Low | High | Clamp + bounds-check every access; ST-15 (AC-15) covers empty + all-disabled no-op |
| Global chord fires the wrong `TabView` with 2+/nested instances (PF-002) | Med | High | `preProcess` handler scoped by `isWithin(ev.getFocused(), this)`; ST-37/38 exercise two-`TabView` scoping + Alt-hotkey collision |
| Page state lost on tab switch if `Show` used (PF-001) | Low | High | Page-switch is a reactive `state.visible` flip (all pages stay mounted), **not** `Show`; ST-2 asserts no mount/dispose |
