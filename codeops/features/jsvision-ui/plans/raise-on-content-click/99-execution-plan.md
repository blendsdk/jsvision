# Task T-02: Raise a background window on a content click (fix #38)

> **Type**: Task (lightweight) · **Feature**: jsvision-ui · **CodeOps Skills Version**: 3.3.0
> **Progress**: 9/9 tasks (100%) · **Last Updated**: 2026-07-07
> **Tracks**: GitHub issue [#38](https://github.com/blendsdk/jsvision/issues/38)
> **TV-derived**: yes — the fidelity gate (GATE-1 decode / GATE-2 diff) applies.

## Objective

Clicking the **content (interior)** of a background window focuses its inner leaf (the caret
activates + blinks there) but does **not raise** the window — so the caret is live in a window that
stays hidden behind another. Clicking the window **border** raises correctly.

**Root cause (verified).** Focus-on-click and raise-on-click are decoupled:

- **Focus** is applied unconditionally in `focusOnClick()` **before** delivery
  (`packages/ui/src/event/hit-test.ts:163`) → the background window's leaf gets `state.focused`.
- **Raise** only fires if the mouse-down **bubbles up** to `Window.onEvent` → `manager.raise(this)`
  (`packages/ui/src/window/window.ts:225`). The bubble stops at the first view that sets
  `ev.handled` (`hit-test.ts:167-178`). An interior view that consumes the down — the `Editor`
  captures the pointer + sets `ev.handled = true` (`packages/ui/src/editor/editor-mouse.ts:60-63`),
  and likewise `Input` / `ListRows` / `Scroller` / `GridRows` — stops the bubble before the window,
  so the raise never runs while focus already moved in.

The mouse/wheel branch of `route()` is terminal — `ctx.hitTestRoute(ev2); return;`
(`packages/ui/src/event/dispatch.ts:148-150`) — so mouse-downs never reach the pre/focus/post
sweeps; the raise must live in the `hitTestRoute` path. Interior clicks yield
`frameZoneAt(...) === 'interior'` (`packages/ui/src/window/frame.ts:221`), i.e. no frame affordance.

Reproduced headlessly: two overlapping windows whose interior leaf consumes the down; a synthetic
`down` inside the background window's interior leaves it **not** active while its leaf is `focused`.

## TV decode (GATE 1) — the faithful behavior

In Turbo Vision the **select + raise happens at the top of the window's own `handleEvent`, before
the positional event descends into the interior**, so it is independent of interior consumption
(`/home/gevik/workdir/github/tvision/source/tvision/`):

- `TGroup::handleEvent` routes a positional event to the subview under the mouse:
  `doHandleEvent(firstThat(hasMouse, &event), ...)` — `tgroup.cpp:377-380`. The subview is the window.
- The window's `handleEvent` begins with `TView::handleEvent(event)`, which for a mouse-down on an
  unselected `ofSelectable` view calls `focus()` — `tview.cpp:553-557`.
- `focus()` → `select()` — `tview.cpp:452-466`; `select()` for an `ofTopSelect` window calls
  `makeFirst()` — the raise — `tview.cpp:728-733`.
- The `ofFirstClick` gate (`!focus() || !(options & ofFirstClick)` → `clearEvent`, `tview.cpp:556-557`)
  is the existing **HR-09** "an inactive window's first click only selects/activates it" behavior,
  already realized in `Window.onEvent`'s `wasActive` affordance gating (`window.ts:224-243`,
  `tframe.cpp:150-193`) — this task must **preserve** it.

So our port inverted the order (raise via an up-bubble to `Window.onEvent`); the fix restores TV's
raise-at-receive-time.

## Design (user-confirmed 2026-07-07 — "pre-bubble select pass, TV-faithful")

Move the raise to a pre-delivery step in the hit-test, so it runs regardless of interior consumption;
keep the frame-affordance logic (move/resize/close/zoom + the HR-09 first-click gate) in
`Window.onEvent`, reading a **recorded** was-active flag.

- **D1 — generic recognition seam.** Add an optional `selectByClick?(): void` method to the `View`
  base (undefined on the base — TV's `ofTopSelect` marker). `Window` overrides it. `hit-test.ts`
  stays window-agnostic: it climbs the hit's ancestors (**clamped to `scopeRoot`** for modal safety,
  mirroring the bubble's `node === scopeRoot` clamp, `hit-test.ts:174`) and invokes the **first**
  ancestor that defines `selectByClick`, then stops. (Rejected: importing `Window` into `hit-test.ts`
  — needless coupling; the optional-method marker is the minimal generic seam.)
- **D2 — single raise site.** `Window.selectByClick()` records
  `this.wasActiveOnPress = this.manager?.activeWindow() === this` **then** `this.manager?.raise(this)`
  (idempotent; a manager-less window is a no-op). Remove the `raise(this)` + inline `wasActive`
  capture from `Window.onEvent`; `onEvent` becomes affordance-only and reads `this.wasActiveOnPress`
  for the close/zoom/grip gating. (Mirrors TV: `select()` at `TView::handleEvent` top; `TFrame`
  affordances handled after.)
- **D3 — order in the hit-test down branch.** (1) climb→`selectByClick()` (raise + record wasActive);
  (2) `focusOnClick(hit.view)` (refine focus to the exact clicked leaf — a window with several
  focusable children must focus the one clicked, not its saved `current`); (3) the existing bubble
  (now `Window.onEvent` = affordance-only). Interior clicks: step 1 raises, the interior consumes,
  `onEvent` never runs (zone would be `interior` anyway). Frame clicks: step 1 raises + records
  wasActive, `onEvent` runs and gates affordances off the recorded flag — HR-09 preserved.
- **D4 — scope.** The fix is at the shared event/window layer, so every interior-consuming widget
  (Editor, Input, ListBox/ListRows, Scroller, GridRows) benefits; no per-widget change.
- **D5 — verify command:** `yarn verify`.
- **No new kitchen-sink story** — this is a window-management behavior fix, not a visual component
  (the WM has no story; coverage is the spec/impl tests below + the existing `demo:tvedit`).

## Affected files (verified)

| File | Change |
|------|--------|
| `packages/ui/src/view/view.ts` | Add the optional `selectByClick?(): void` seam to `View` (undefined default; JSDoc = TV `ofTopSelect`). |
| `packages/ui/src/event/hit-test.ts` | In the `down` branch, before `focusOnClick`, climb hit→ancestors (clamped to `scopeRoot`) and invoke the first `selectByClick`. |
| `packages/ui/src/window/window.ts` | Add `wasActiveOnPress` + override `selectByClick()` (record + raise); remove `raise`/`wasActive` from `onEvent`; `onEvent` reads `wasActiveOnPress`. |

## Tasks

**Spec tests first (red):**

- [x] T-02.1 Spec regression test — a mouse-down on the **interior** of a non-active window whose
      content leaf **consumes** the down (sets `ev.handled`, captures the pointer — the `Editor`
      shape) **raises** that window to active AND focuses its inner leaf. Dispatch through the loop
      (`app.loop.dispatch`), assert `app.desktop.activeWindow()` is the clicked window and its leaf
      `state.focused`. Model the harness on `app-shell.desktop.impl.test.ts` (createApplication +
      `mouse()` + overlapping `addWindow`s). *(New `test/raise-on-content-click.spec.test.ts` — ST-1.)*
- [x] T-02.2 Spec guard — the existing **HR-09** first-click behavior is preserved: the first click
      on an **inactive** window's frame **close/zoom/resize** column only raises+activates (no
      close/zoom/resize); the second (now-active) click performs it. *(ST-2 in the same file; the
      existing `app-shell.hardening.*` HR-09 oracles are the cross-check.)*
- [x] T-02.3 Run the new tests — confirmed **ST-1 fails red** (window not raised on an
      interior-consumed click — activeWindow stays "Untitled") and ST-2 passes. *(2026-07-07.)*

**Implement (green):**

- [x] T-02.4 Add the `selectByClick?(): void` optional seam to `View` (`view.ts`) — JSDoc: the
      click-select/raise boundary (TV `ofTopSelect`); undefined on the base so a plain view is inert.
- [x] T-02.5 `Window` (`window.ts`): added `protected wasActiveOnPress = false`; override
      `selectByClick()` records `wasActiveOnPress` from `manager?.activeWindow() === this` then
      `manager.raise(this)` (manager-less = no-op). Removed the `raise(this)` + inline `wasActive`
      from `onEvent`; it now reads `this.wasActiveOnPress`. Kept `ev.handled` + frame-zone mapping.
- [x] T-02.6 `hit-test.ts`: added `selectOnClick(hit, scopeRoot)` — climbs `hit.view`→ancestors
      (clamped to `scopeRoot`), invokes the first `selectByClick`, then stops; called before
      `focusOnClick` in the `down` branch (D1/D3). No other read-site changes.
- [x] T-02.7 Ran ST-1/ST-2 — **green**; full `@jsvision/ui` unit suite 1286/1286 green (no
      regressions in `app-shell.*`/`window`/`desktop`/`editor`). *(2026-07-07.)*

**Impl tests + fidelity gate + verify:**

- [x] T-02.8 Impl tests (`test/raise-on-content-click.impl.test.ts`, 4 tests green) — edge cases:
      (a) a manager-less (standalone) `Window`'s `selectByClick()` is a safe no-op; (b) an interior
      click on the **already-active** front window stays active (idempotent) + focuses the leaf, no
      close/zoom; (c) the climb is **clamped to `scopeRoot`** — a click inside a modal `Dialog` keeps
      the dialog active and never raises the window behind it; (d) a frame (title) click still routes
      to `Window.onEvent` post-select-pass (begins a move on the active window).
- [x] T-02.9 **TV fidelity GATE-2 (AFTER-diff)** — re-opened `tgroup.cpp:377-380` / `tview.cpp`
      (`552-558` mouse-down `focus()`, `452-466` `focus()`→`select()`, `728-736` `select()`→
      `makeFirst()` for `ofTopSelect`); the shipped pre-delivery select pass is the faithful port,
      **no mismatch**. Recorded the decode in `window.ts` `selectByClick` + `hit-test.ts`
      `selectOnClick` JSDoc. Full `yarn verify` 11/11 turbo (ui 1290/1290) + `yarn lint` clean. *(2026-07-07.)*

**Verify**: `yarn verify`
