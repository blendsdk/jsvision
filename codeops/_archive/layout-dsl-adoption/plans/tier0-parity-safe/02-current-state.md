# 02 — Current State

> Grounded in a read-only sweep of the working tree (branch `feat/dsl-adoptation`). All snippets are
> verbatim; line numbers are as-of authoring and may drift — anchor on the code, not the number.

## The DSL builders (targets of the swap)

`packages/ui/src/view/dsl/absolute.ts` — all three are **merge-preserving** (`{ ...view.layout, ... }`)
and return the same instance:

```ts
// at(view, x,y,w,h) | at(view, rect)  — lines 39-46
view.layout = { ...view.layout, position: 'absolute', rect };   // no `centered`
// cover(view)  — lines 69-72
view.layout = { ...view.layout, position: 'fill' };             // no rect, no `centered`
// center(view, width, height)  — lines 93-97   (width/height REQUIRED)
view.layout = { ...view.layout, position: 'absolute', rect: { x: 0, y: 0, width, height } };
view.centered = true;                                            // no `padding`
```

Pinned by `packages/ui/test/dsl-absolute.spec.test.ts` (immutable): `cover` → `position:'fill'`
(:56-62); `center(v,40,12)` → `{position:'absolute', rect:{0,0,40,12}}` + `centered===true` (:66-71);
`at` merge-preserves `direction` (:20-32). **These are not edited by this plan.**

## R-1 — Base `Dialog` self-centering

`packages/ui/src/dialog/dialog.ts:99-109` (constructor):

```ts
const width = opts.width ?? opts.rect?.width;
const height = opts.height ?? opts.rect?.height;
this.centered = opts.centered ?? (width !== undefined && height !== undefined && opts.rect === undefined);
if (width !== undefined && height !== undefined) {
  const x = opts.rect?.x ?? 0;
  const y = opts.rect?.y ?? 0;
  this.layout = { position: 'absolute', padding: 1, rect: { x, y, width, height } };
}
```

Three behaviors to preserve: (a) sized + no rect → centered at origin; (b) explicit rect → honored,
not centered; (c) explicit `centered` overrides either. **`padding:1` is co-located in the same
assignment** — `center()`/`at()` don't set it (PA-6). Witnessed by `dialog.centering.spec.test.ts`
(:35-88), `dialog.centering.impl.test.ts`, `dialog.resize.impl.test.ts` (:44-89, asserts the
`bounds` vs `layout.rect` split + `centered` flag + commit-on-grab freeze).

## R-2 — `formDialog` body

`packages/forms/src/form-dialog.ts:227`:

```ts
body.layout = { ...body.layout, position: 'fill' };   // ← already byte-identical to cover(body)
```

Witnessed by `packages/forms/test/form-dialog.impl.test.ts:104-133` (`bodyGroup.bounds.width > 0`,
bound value paints). Pure `cover(body)` substitution; no test edit. (The button row uses a local
`place()` helper at :58-62 — **out of scope**, Tier 2.)

## R-3 — Menu outside-click catcher

`packages/ui/src/menu/controller.ts` — `mountCatcher()` (:230) and `resize()` (:282-288):

```ts
catcher.layout = { position: 'absolute', rect: { x: 0, y: 0, width: vp.width, height: vp.height } };  // :230
// ...
function resize(): void {                                     // :282
  if (catcher === null) return;
  const vp = viewport();
  catcher.layout = { position: 'absolute', rect: { x: 0, y: 0, width: vp.width, height: vp.height } };  // :286
  catcher.invalidateLayout();
}
```

`resize()` is invoked from `application.ts:437` (`menu?.controller?.resize()`). **No test asserts the
catcher's rect** — menu specs assert click/open behavior and popup anchoring (`app-shell.menu.spec`,
`app-shell.menu.impl:144`, `menu-flex.*`). Target: `cover(catcher)` at mount; `resize()`'s re-anchor
body becomes a no-op (fill re-solves). The catcher's parent is the **app overlay**, which stays
absolute (PA-1/PA-8), so the menu-spec overlay locator keeps working.

## R-4 — Dropdown popup catcher

`packages/ui/src/dropdown/popup.ts:249-253`:

```ts
const catcher = new PopupCatcher(dismiss);
catcher.layout = {
  position: 'absolute',
  rect: { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height },
};
```

No `onResize` override (popup is transient). `popup.spec.test.ts` / `popup.impl.test.ts` build their
**own** harness overlay (`spec:65`, `impl:42`) and assert the *frame* placement/clamp (`spec:120-166`)
— not the production catcher's rect. Target: `cover(catcher)`; the sibling `frame` keeps its anchored
`placePopup(...)` (a keep-absolute, caret-anchored placement — not touched).

## The deferred site (context, NOT converted here)

`packages/ui/src/app/application.ts:332-336` (init) and `:430-439` (`loop.onResize` re-anchor) place
the app overlay full-viewport absolute. `app-shell.lifecycle.impl.test.ts:41-43` locates it via
`c.layout.position === 'absolute'` and `:51,:59` assert `overlay.layout.rect`; **`app-shell.menu.spec.test.ts:58-59`
uses the same locator (spec oracle).** `cover()` (→ `position:'fill'`, no rect) breaks all three →
**deferred to #115** (PA-1). This plan leaves `application.ts` untouched, so those tests stay green
unedited — which is itself the proof (ST-8) that the overlay was not converted.

## R-5 — Demos / demo-shell (enumerated, bounded per PA-5)

Hand-computed centering → `center()`:
- `packages/examples/controls-live/main.ts:81-91` — `Math.floor((dw-width)/2)` into `dialog.layout.rect`.

Full-viewport / full-interior absolute → `cover()`:
- Demo shells: `kitchen-sink/shell.ts:164,261` · `datagrid-showcase/shell.ts:166,306`.
- Walkthrough roots: `color-demo/main.ts:52,77` · `date-demo/main.ts:43,71` · `dropdowns-demo/main.ts:51`
  · `tabs-demo/main.ts:64` · `table-demo/main.ts:78` · `feedback-demo/main.ts:54` · `tree-demo/main.ts:60`
  · `surface-demo/main.ts:50` · `containers-demo/main.ts:58,86,116` · `files-demo/main.ts:103,129`
  · `wizard-demo/main.ts:53`.

Guarded by **output-parity e2e** (`packages/examples/test/shell-demo.e2e.test.ts`,
`layout-dsl-playground.smoke.spec.test.ts`, `datagrid-showcase.walkthrough.spec.test.ts`, per-demo
`*.e2e.test.ts`) — these snapshot/assert output frames, **not** `layout.rect` values, so a parity-safe
`cover()`/`center()` swap keeps them green unedited. Inner-widget `at()` sites in the same files
(e.g. `dropdowns-demo/main.ts:68,71,95,122,147,150`) are **Tier 3, out of scope**.

## R-6 — CLAUDE.md carve-out (current state)

The "Turbo Vision fidelity (porting guideline)" section already documents a "deliberate divergence"
concept but lists **no** specific non-faithful components. This plan appends a short carve-out block
naming the FR-1 set. Doc-only (`CLAUDE.md` is out of the JSDoc/`check:docs` scope and in
`.prettierignore`'s spirit — it is process/config, not shipped `packages/*/src`).
