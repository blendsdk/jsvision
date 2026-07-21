# 03-02 — Component: catchers `cover()` + `formDialog` body `cover()`

> **Targets**: `menu/controller.ts`, `dropdown/popup.ts`, `forms/form-dialog.ts` ·
> **Requirements**: R-2, R-3, R-4 · **Divergence**: none

Three `position:'absolute'` full-viewport / `position:'fill'` placements adopt `cover()`. Each
`cover()` sets `position:'fill'` — the catcher/body then re-fills its parent on every reflow with no
manual re-anchor, which is why the manual resize paths can be deleted.

## R-3 — Menu outside-click catcher (`menu/controller.ts`)

`mountCatcher()` (~:230): replace the literal with `cover(catcher)` before `overlay.add(catcher)`.

`resize()` (~:282-288): its whole purpose was to re-anchor the absolute rect. With `position:'fill'`
that is automatic, so the re-anchor body is removed. Keep the function as a **no-op stub** rather
than deleting it, because `application.ts:437` calls `menu?.controller?.resize()` and that call site
is **not** part of this plan (the app overlay is deferred, PA-1). A no-op stub keeps the call safe and
the diff local to `controller.ts`.

```ts
function mountCatcher(): void {
  // ...build catcher...
  cover(catcher);              // was: catcher.layout = { position:'absolute', rect:{0,0,vp.w,vp.h} }
  overlay.add(catcher);
}
/** No-op: the catcher now fills its parent (cover()) and re-solves on resize automatically. */
function resize(): void {}     // call site in application.ts is retained; body no longer re-anchors
```

**Parent stays absolute.** The catcher's parent (the app overlay) is unchanged, so
`app-shell.menu.spec.test.ts:58-59`'s `position === 'absolute'` overlay locator still resolves. No
menu test asserts the catcher's own rect. Add `ST-9` (dismiss-after-resize) to pin the deleted
re-anchor's behavior.

## R-4 — Dropdown popup catcher (`dropdown/popup.ts:249-253`)

Replace the literal with `cover(catcher)`:

```ts
const catcher = new PopupCatcher(dismiss);
cover(catcher);                // was: catcher.layout = { position:'absolute', rect:{ x:viewport.x, ... } }
overlay.add(catcher);
overlay.add(frame);            // frame keeps its anchored placePopup(...) — a keep-absolute placement
syncOverlayVisible(overlay);
```

> **Note the one behavioral difference to check:** the old catcher rect used `viewport.x/viewport.y`
> as its origin; `cover()` fills the parent from `{0,0}`. This is safe **iff** the catcher's parent
> (`overlay`) is itself the full viewport — which it is (the app overlay). The catcher only needs to
> cover the clickable area to dismiss on outside-click; it paints nothing. `popup.spec`/`popup.impl`
> assert the **frame**, and the frame's `placePopup` still receives the real `viewport` — unchanged.
> Confirm `popup.spec.test.ts:120-166` stays green (ST-6).

## R-2 — `formDialog` body (`forms/form-dialog.ts:227`)

Pure substitution — the current line is already what `cover()` produces:

```ts
const body = options.body(form);
cover(body);                   // was: body.layout = { ...body.layout, position: 'fill' }
dlg.add(body);
```

Keep the surrounding comment's *why* (a body of all-absolute children would collapse to zero width
without a fill overlay — see the absolute-children-collapse footgun). `form-dialog.impl.test.ts:104`
passes unedited (ST-5).

## Imports

`cover` from the DSL barrel in each file (`../view/dsl/index.js` for ui; the forms package imports
the DSL from `@jsvision/ui`). Match each file's existing import style.

## Verification

`ST-5` (formDialog body), `ST-6` (dropdown frame), `ST-7` (menu open/close witness), `ST-9`
(menu dismiss-after-resize, new). All witness/characterization; no spec oracle edited.
