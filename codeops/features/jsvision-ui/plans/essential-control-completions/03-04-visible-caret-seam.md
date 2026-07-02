# 03-04 — Visible caret: View → host seam (additive)

> Additive across `packages/ui/src/view/`, `event/`, `app/run.ts`. Reuses core `cursor.*` — **no core
> change** (preflight + challenger confirmed, PA-5). TV parallel: `TView::showCursor`/`setCursor`,
> `sfCursorVis`.

## Design (PA-5)

A four-hop, purely additive seam so the **real blinking terminal cursor** sits at the focused view's caret
cell:

1. **`View.desiredCaret(): Point | null`** — new overridable method, default `return null` (no caret). The
   focused `Input` overrides it to return its view-local caret `{ x: displayedPos(curPos)-firstPos+1, y: 0 }`
   when focused (PA-11: only `Input` overrides it in RD-07; clusters keep the default).
2. **`RenderRoot`** — expose a **pure lookup** `originOf(view: View): Point | null` that returns the view's
   absolute compose origin from the persisted per-view context cache (`render-root.ts:110` `cache.set(view,
   { origin, clip, order })`). The cache is refreshed on every compose and cleared **only** on a full compose
   (`:272`), so an origin survives partial recomposes — a view unchanged this frame keeps its last origin.
   Returns `null` if the view was never composed (not mounted/visible). Public `RenderRoot` interface gains
   this one accessor (additive; `{mount,resize,flush,serialize,buffer}` unchanged). **RenderRoot stays
   focus-agnostic** — it does *not* collect the caret during `compose` (that would fail on a partial recompose
   that does not visit the focused view — PF-002).
3. **`EventLoop`** — add a sibling hook **`onCaret?: (cell: Point | null) => void`** next to `onFrame`
   (`event-loop.ts:53`) and **compute the caret in the loop, after `flush()`** (the loop is the component
   that owns focus — `focus.getFocused()`, `event-loop.ts:96-98`):
   ```ts
   // after renderRoot.flush() in runTick (:176), resize, and mount:
   const leaf = this.focus.getFocused();           // the focused view (or null)
   const local = leaf?.desiredCaret() ?? null;     // its view-local caret request (or null)
   const origin = leaf && local ? this.renderRoot.originOf(leaf) : null;
   const cell = origin && local
     ? { x: origin.x + local.x, y: origin.y + local.y }   // absolute, clamped to the buffer
     : null;
   this.onCaret?.(cell);                            // fired right after onFrame
   ```
   This is independent of *which* views repainted this frame: the focused `Input` need not be in the dirty
   set for the caret to stay correct (it reads the persisted origin). `onCaret(null)` when focus is lost or the
   focused view requests no caret. Additive; existing `onFrame` signature unchanged (mirrors `setCapture`).
4. **`run()`** — `run()` **co-owns** the output stream (it already receives it via `RunContext.output` and
   passes it to `createHost`, `run.ts:34-35,50-55`). Wire `ctx.loop.onCaret = (cell) => { ... }`: when `cell`
   is non-null write `cursor.to(cell.y+1, cell.x+1) + cursor.show()`; when null write `cursor.hide()` — to
   the co-owned stream, **after** `host.render(buffer)` each frame (ordering: buffer diff first, then cursor
   placement). Re-apply on `onResume` (the host repaints the buffer + re-hides the cursor on SIGCONT,
   `host/signals.ts:110-124`, but not the caret).

### Clipboard-write rides the same seam
`run()` also wires the loop's `writeClipboard?(seq)` option (03-01) to the same co-owned stream, so
`Input`'s `ev.setClipboard(text)` → `event-loop.ts routeContext` → `setClipboard(text, caps)` → `run()`
writes the OSC-52 sequence. Caps-gated no-op. Additive envelope seam alongside `emit`/`setCapture`.

## Why additive (not a reshape)
- `View.desiredCaret` — new method, default null → no existing subclass changes (AC-12).
- `RenderRoot.originOf(view)` — new **read-only** accessor over the origin cache compose already maintains
  (`render-root.ts:110`); no walker reshape, no compose-order coupling. The loop (not the root) derives the
  caret, so a partial recompose that skips the focused view can't drop it (PF-002).
- `EventLoop.onCaret` / `writeClipboard` — new optional fields; `onFrame`/`render` signatures untouched.
- `run()` — new assignments; `host.render(buffer)` unchanged; the `Host` interface untouched.

## Logical caret (companion, lives in 03-01)
Independent of the hardware seam: `Input.draw()` marks the caret **cell in the buffer** (visible attribute)
so the caret shows even where the terminal cursor can't (headless, or cursor-hidden terminals). AC-11 tests
the buffer cell; AC-12 tests the `onCaret` payload (the absolute cell) headlessly — no real TTY needed.

## Testability
- **AC-11 (logical):** assert the marked buffer cell at `displayedPos(curPos)-firstPos+1` moves with the
  cursor + horizontal scroll.
- **AC-12 (hardware seam):** drive the loop headlessly, assert `onCaret` receives the correct absolute cell
  for a focused `Input`, `null` when focus is lost / no requester; assert no `onFrame`/`render`/`Host`
  signature changed (the additive-seam oracle). Assert `run()` re-applies on `onResume`. **Partial-recompose
  persistence (PF-002):** with a focused `Input` unchanged, invalidate/repaint a *different* view and assert
  the next `onCaret` still reports the Input's correct absolute cell (the caret is not dropped just because the
  Input was not in the dirty set). See ST-14.

## Security
The caret escape is built only from **clamped, in-bounds** cell coordinates (no app text in the escape).
`writeClipboard` emits only `setClipboard`'s base64+sanitized OSC-52 (no raw bytes). AC-15.
