# Gotchas

The twelve footguns that separate "it works" from expert jsvision code. Check your app against
**every one** before calling it done. Each is symptom → cause → fix.

### 1. A custom leaf view is invisible

**Symptom:** a `View` you wrote paints nothing and seems to have zero size.
**Cause:** it is in an `auto`-sized layout slot and has no `measure()`, so it resolved to `{0,0}`.
**Fix:** override `measure(available): { width, height }` and return a non-zero size — or give the
view an explicit fixed `size` / absolute `rect`.

### 2. `bind()` throws "requires a mounted view"

**Symptom:** an error the moment you construct a view that binds a signal.
**Cause:** `view.bind(...)` was called in the constructor, before the view's reactive scope exists.
**Fix:** wrap it: `this.onMount(() => this.bind(() => this.sig(), () => undefined))`. Same for
`onCleanup`.

### 3. Absolute children land in the wrong place

**Symptom:** an absolutely-positioned child appears offset from where you expected.
**Cause:** absolute rects are **parent-interior-relative**, not screen-relative — `{ x: 0, y: 0 }`
is the parent's top-left content cell.
**Fix:** position children relative to their parent. Use
`view.layout = { position: 'absolute', rect: { x, y, width, height } }` (windows accept the
`win.layout.rect = …` shorthand).

### 4. Dialog/Window children look doubly inset

**Symptom:** content inside a `Window`/`Dialog` sits one cell further in than your rects say.
**Cause:** these default to `padding: 1` (the frame inset); an absolute child's rect is measured
**inside** that padding.
**Fix:** account for the one-cell inset in your child rects, or set the container's `padding: 0` and
place children yourself.

### 5. A Dialog won't stay where you put it

**Symptom:** a `Dialog` re-centers itself after a resize and can't be dragged freely.
**Cause:** a Dialog created with `width`/`height` (no `rect`) auto-centers on every reflow.
**Fix:** give it an explicit `rect` for a fixed, movable position; use the auto-centering form only
for transient modals.

### 6. A signal change doesn't repaint

**Symptom:** you set a signal from a timer or a plain callback and the screen doesn't update.
**Cause:** the write happened outside a dispatch tick, so the frame was marked dirty but never
flushed.
**Fix:** call `app.loop.renderRoot.flush()` after the write, or emit a no-op command
(`app.loop.emitCommand('tick')`) so the loop coalesces one frame. Writes made inside an event handler
flush automatically.

### 7. A window added after startup is 0×0

**Symptom:** `desktop.addWindow(win)` after the app is running shows nothing until the next resize.
**Cause:** the new window has not been through a layout pass yet.
**Fix:** trigger a reflow — `app.loop.resize(app.loop.renderRoot.size)` (or the current size) — after
adding late windows. (In tests, `loop.resize({ width, height })` both reflows and flushes.)

### 8. A modal never resolves (hung `execView`)

**Symptom:** `await loop.execView(dialog)` never returns after the user closes the dialog.
**Cause:** the dialog was closed with `Window.close()`, which removes the view without ending
modality.
**Fix:** let the close resolve the modal — a frame close box / Esc must resolve `'cancel'`, and OK
must resolve through the modal host. A `Dialog` does this for you; a custom modal must call
`endModal(result)`.

### 9. Reactive graphs leak across swaps

**Symptom:** effects keep firing for views you replaced; memory grows.
**Cause:** a reactive graph created outside a view's own scope was never disposed.
**Fix:** own hand-built graphs with `createRoot((dispose) => { … })` and call `dispose()` when
swapping. Views manage their own scope, so signals read inside a view are fine.

### 10. Keyboard does nothing in a list/grid

**Symptom:** arrow keys don't move the selection in a `ListView`/`DataGrid`.
**Cause:** focus was put on the container instead of its inner rows renderer.
**Fix:** focus the rows target — `loop.focusView(list.rows)` / `loop.focusView(grid.rows)`, not the
list/grid group.

### 11. "Cannot find module" on a relative import

**Symptom:** a relative import fails at runtime or typecheck.
**Cause:** the specifier omitted the `.js` extension. jsvision is NodeNext ESM.
**Fix:** always write `.js` in relative specifiers, even from a `.ts` source: `from './view.js'`.

### 12. You need something no widget provides

**Symptom:** none of the catalog widgets fit the visual you need.
**Cause:** that's expected — the catalog is finite.
**Fix:** subclass `View` (the sanctioned escape hatch): implement `measure()` + `draw(ctx)` and bind
in `onMount`. Drawing is view-local and auto-clipped, so you can't corrupt the screen. See
`widget-authoring.md`.
