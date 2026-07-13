# Current State: Input Dropdowns

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Maps the exact code the `dropdown/` subsystem builds on / extends. All cites verified against
`packages/{ui,core}/src` on 2026-07-02 (current-state recon).

## Existing Implementation

### What Exists

Every primitive the dropdowns need already ships — this RD composes, it does not build new engine
mechanism. The four load-bearing pieces:

1. **App overlay** — `app/application.ts:140-142` creates one full-viewport `Group` with
   `overlay.state.visible = false`; the `MenuBar` is wired to it via `menuBar.attach(overlay, seam)`
   (`:176-183`), where `seam: MenuLoopSeam` (`menu/controller.ts:19-29`) exposes
   `emitCommand`/`isCommandEnabled`/`focusView`/`getFocused`.
2. **Menu controller** — `menu/controller.ts` is the pattern the popup generalizes: a transparent
   full-viewport `CatcherView` (`:71-95`) swallows outside mouse-downs (`onEvent` → `onDown(local)`
   + `ev.handled = true`), mounted via `overlay.add(catcher)` (`:205-221`); it toggles
   `overlay.state.visible = true` (`:229`) / `false` (`:247`) and saves/restores focus (`:225/:251`).
3. **`ListView<T>`** — `list/list-view.ts:19-36` `ListViewOptions<T>` = `items`/`getText`/`focused?`/
   `selected?`/`onSelect?`/`command?`/`sorted?`/`typeAhead?`; exposes public readonly `rows` (the
   focus target), `focused`, `selected` (`:42-49`). The dropdown list *is* a `ListView<T>`.
4. **`Input`** — `controls/input.ts`: the bound `value: Signal<string>` (`:67`), `maxLength` (`:69`),
   and `selectAll()` (`:433`) are all **`protected`** — not a public linkage surface today.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/ui/src/app/application.ts` | Overlay + attach-seam | Add `syncOverlayVisible` helper (imperative child-count derive, PA-5/PF-001); source the popup-host envelope seam (PF-002) |
| `packages/ui/src/menu/controller.ts` | The generalized pattern; `CatcherView`, focus save/restore | **Replace** the explicit `visible` toggles (`:229/:247`) with `syncOverlayVisible` calls (PA-5/PF-001); the popup reuses (not edits) the catcher/save-restore pattern |
| `packages/ui/src/list/list-view.ts` | The dropdown list | None — reused as-is |
| `packages/ui/src/controls/input.ts` | Linked/composed field | Add public linkage seam: `selectAll()` public + `getValueSignal()` + `getMaxLength()` (PA-8) |
| `packages/ui/src/view/view.ts` | `focusSignal()` (PF-009) at `:88-90` | None — reused for list-focus-loss dismissal (guard on `state.focused===false`, PF-004) |
| `packages/ui/src/view/types.ts` | `DispatchEvent` envelope at `:100-143` | Add `getFocused()` + a `PopupHost` accessor to `DispatchEvent` (PF-002) |
| `packages/ui/src/event/{event-loop,dispatch}.ts` | `routeContext` seam builder (`event-loop.ts:302-306`, `dispatch.ts:133-135`) | Source the new `getFocused`/popup-host envelope fields (PF-002) |
| `packages/core/src/engine/color/theme.ts` | `Theme` + `defaultTheme` | Add 5 additive History roles (PA-12) |
| `packages/ui/src/index.ts` | Public entry | Add `dropdown/` explicit named re-exports |

### Code Analysis

**The `CatcherView` pattern (menu/controller.ts:71-95)** — reused verbatim in shape; the popup's
catcher must **not** inherit the menu-specific `local.y === 0` bar-row switch (`:210`), the
`popup.highlight`/`onPick` menu state (`:177/:181`), or the multi-level stack (`:142`). It is just:
transparent, full-viewport, on outside mouse-down → dismiss + consume.

**Focus-change signal (view.ts:76-90)** — `focusSignal(): Signal<void>` is a public per-view tick
(lazy, `equals: () => false`); poked by the focus manager on both the losing and gaining view
(`event/focus.ts:111/115`). `Label` consumes it: `this.bind(() => this.link.focusSignal()())`
(`controls/label.ts:43-45`). The popup uses the same pattern to observe the **list** losing focus
(dismiss trigger, PA-15).

**Theme role shape (theme.ts:16-22)** — `ThemeRole = { fg, bg, hotkey? }`; richer roles extend it
(`window: ThemeRole & { border, title, icon }`, `:174`). The History `window` role mirrors that.

**Packaging (menu/index.ts + index.ts:55-91)** — a subsystem exports a barrel with separated
value/type exports + `.js` specifiers; `src/index.ts` re-exports explicitly per subsystem
(e.g. `export { ListView, ListBox } from './list/index.js'; export type { ListViewOptions, … }`).

## Gaps Identified

### Gap 1: No public Input linkage surface
**Current:** `value`/`maxLength`/`selectAll()` are `protected` (`input.ts:67/69/433`).
**Required:** `History` (linking an app-created `Input`) must read the field's value signal +
`maxLength` and call `selectAll()` after a pick (`thistory.cpp:106-107`).
**Fix:** promote `selectAll()` to public; add `getValueSignal()` + `getMaxLength()` (PA-8).

### Gap 2: Single-flag overlay can't host two clients
**Current:** one `overlay.state.visible` boolean, toggled explicitly by the menu controller.
**Required:** a `MenuBar` and a dropdown popup can be open together (F10 while a combo is open)
without one's `close()` hiding the other.
**Fix:** derive visibility from the live child count — **imperatively**, since `overlay.children`
(`group.ts:33`) and `state.visible` (`view.ts:47`) are not reactive (PF-001): a
`syncOverlayVisible(overlay)` helper (`visible = children.length > 0` + `invalidate()`) called by both
the menu controller (**replacing** its `:229/:247` assignments at the same sites) and the popup after
each `overlay.add`/`remove` (PA-5, [03-04](03-04-seams-and-theme.md) §2).

### Gap 4: A leaf control can't reach the overlay / focus manager
**Current:** the overlay is wired only into the `MenuBar` via `menuBar.attach(overlay, seam)`
(`application.ts:176-183`); `DispatchEvent` (`view/types.ts:100-143`) offers
`emit`/`focusView`/`setCapture` but **no `getFocused` and no overlay accessor**, and `View.host` is
only the render-root dirty-set seam.
**Required:** an app-created `History`/`ComboBox` leaf must, at open time, save the prior focus and
mount its popup into the overlay.
**Fix:** an additive `DispatchEvent` envelope seam (`getFocused()` + a `PopupHost` accessor) sourced
in the loop's `routeContext`, matching how `emit`/`focusView`/`setCapture` already reach leaves
(PF-002, [03-02](03-02-anchored-popup.md) "Host acquisition").

### Gap 3: The overlay/catcher pattern is menu-specific
**Current:** `menu/controller.ts` hard-codes menu semantics into the catcher + popup.
**Required:** a reusable anchored-popup primitive for both dropdowns.
**Fix:** extract the generic mechanism into `dropdown/popup.ts` (new; no edit to the menu code
beyond PA-5). The menu keeps its own controller.

## Dependencies

### Internal
- RD-11 `ListView`/`ScrollBar` (`list/`, `scroll/`), RD-05 overlay + catcher (`app/`, `menu/`),
  RD-06/07 `Input` (`controls/`), RD-01 signals + RD-03 `bind`/`invalidate`/`DrawContext`/
  `focusSignal`, RD-04 `setCapture`/`releaseCapture`. All done.
- `@jsvision/core` `Theme`/`defaultTheme`, `sanitize`, `ScreenBuffer`.

### External
- None. Zero runtime deps.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Menu regression from the derived-visibility migration (PA-5) | Med | High | Phase 0 lands + regression-tests the derived model before any dropdown; keep the existing menu spec/impl tests green |
| Popup geometry mis-transcription (frame/grow off-by-one) | Med | Med | GATE-1 decode captured in 03-01 with exact arithmetic; GATE-2 cell-by-cell diff task |
| List-focus-loss dismissal races the outside-click catcher (double dismiss) | Low | Med | Single dismissal path (idempotent `dismiss()`); impl test for Esc+click+Tab-away ordering |
| `maxLength = Infinity` field (no cap) breaks clamp math | Low | Low | Clamp is `str.slice(0, maxLength)`; `Infinity` slice is a no-op (correct) |
