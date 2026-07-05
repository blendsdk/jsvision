# 03-02 — `SurfaceView` (faithful `delta`-viewport)

> **Document**: 03-02-surface-view.md · **Parent**: [Index](00-index.md)
> **Covers**: AC-3, AC-4, AC-5, AC-8, AC-9, AC-10, AC-13 · **AR**: PA-3/6/11
> **CodeOps Skills Version**: 3.3.0
> **TV-derived — GATE-1/GATE-2 MANDATORY.**

A passive `View` that displays a `delta`-offset viewport onto a bound `Surface`. Its **draw geometry
is a decode** of `TSurfaceView::draw()`.

---

## TV decode (GATE-1) — `TSurfaceView::draw()`

**Source:** `source/tvision/tsurface.cpp:93-141`; palette `surface.h:56-71` + `tsurface.cpp:19,98,143-146`.

```
draw():
  if (size.x <= 0 || size.y <= 0) return;                 // :95  degenerate view → nothing
  cEmpty = mapColor(1);                                    // :98  empty-area colour = frame passive
  if (surface):
     extent = Rect(0,0, size.x, size.y)                    // :102 view-local extent
     clip   = Rect(0,0, surface.size).move(-delta).intersect(extent)   // :105-107
     if (0 <= clip.a.x < clip.b.x && 0 <= clip.a.y < clip.b.y):        // :108-109 non-empty guard
        data = &surface.at(max(delta.y,0), max(delta.x,0)) // :111 first visible cell (delta clamped ≥0)
        if (clip == extent):                               // :112 surface fills view → direct copy
           for y in 0..size.y: writeBuf(0,y,size.x,1,data-row)          // :114-115
        else:
           fillWithSpaces(b, size.x, cEmpty)               // :118 scratch row of empty spaces
           writeLine(0, 0,        size.x, clip.a.y, b)      // :120 TOP margin band
           writeLine(0, clip.b.y, size.x, size.y-clip.b.y, b)           // :121 BOTTOM margin band
           for y in clip.a.y..clip.b.y:                     // :123-132 surface rows
              if (clip.a.x==0 && clip.b.x==size.x): writeBuf(row)       // full width, direct
              else: memcpy(b[clip.a.x], data-row, clip width); writeBuf(0,y,size.x,1,b)  // side margins from b
  else:                                                     // :136-140 null surface
     fillWithSpaces(b, size.x, cEmpty); writeLine(0,0,size.x,size.y,b)  // whole view empty
```

**Decoded facts** (re-verify cell-by-cell at GATE-2):

| Fact | Decode | `file:line` |
|------|--------|-------------|
| Degenerate view | `size.x<=0 || size.y<=0` → draw nothing | `:95` |
| Empty-area colour | `mapColor(1)` = palette entry 1 = **`TWindow`/`TDialog` frame passive** → jsvision **`windowInactive`** `0x17` | `:98`, surface.h:60-71, theme.ts:335 |
| Clip rect | `Rect(0,0,surface.size).move(-delta) ∩ extent` | `:105-107` |
| First visible cell | `surface.at(max(delta.y,0), max(delta.x,0))` (negative delta clamped) | `:111` |
| Surface fills view | `clip == extent` → direct row copy, **no margins** | `:112-115` |
| Top / bottom margins | `writeLine` rows `[0,clip.a.y)` and `[clip.b.y,size.y)` in `cEmpty` | `:120-121` |
| Side margins | scratch `b` prefilled with `cEmpty`; surface memcpy'd into `b[clip.a.x..clip.b.x)`; left `[0,clip.a.x)` + right `[clip.b.x,size.x)` stay empty | `:118,123-132` |
| Null surface | whole view = spaces in `cEmpty` | `:136-140` |
| Palette | `cpSurfaceView "\x01"`, 1 entry | `:19,143-146` |

**Deviation (PA-3):** TV's non-empty-clip guard (`:108-109`) means a surface scrolled **fully outside**
the viewport (empty clip) draws **nothing** (stale cells). jsvision treats empty-clip == null-surface →
**fill the whole view** with `cEmpty` spaces (AC-9). Safe, deterministic extension; recorded in JSDoc.

---

## jsvision `SurfaceView.draw(ctx)` (the decode, via `DrawContext`)

`writeBuf`/`writeLine`/`mapColor(1)` map to `ctx` calls; the raw `TScreenCell` copy maps to a
**cell-aware blit** reading `surface.get(srcX, srcY)`:

```ts
draw(ctx: DrawContext): void {
  const cEmpty = ctx.color('windowInactive');           // mapColor(1)  (AC-4/AC-10)
  const V = { x: ctx.size.width, y: ctx.size.height };
  this.version();                                        // track surface content changes (AC-6, PA-5)
  const s = this.surfaceValue();                         // Surface | null (reactive)
  const d = this.delta();                                // reactive two-way delta

  if (V.x <= 0 || V.y <= 0) return;                      // degenerate (:95)
  const clip = s ? computeClip(s.size, d, V) : EMPTY;
  if (!s || clip.width <= 0 || clip.height <= 0) {       // null OR fully-outside (PA-3, :136 / guard)
    ctx.fillRect(0, 0, V.x, V.y, ' ', cEmpty);           // whole view empty (AC-4/AC-9)
    return;
  }
  // margins (:120-132) — fill each with spaces in cEmpty
  for (const m of marginRects(clip, V)) ctx.fillRect(m.x, m.y, m.width, m.height, ' ', cEmpty);
  // blit the surface cells inside clip → view-local (clip.x,clip.y) (:114/123-132)
  const srcX0 = Math.max(d.x, 0), srcY0 = Math.max(d.y, 0);   // (:111)
  for (let vy = clip.y; vy < clip.y + clip.height; vy++) {
    for (let vx = clip.x; vx < clip.x + clip.width; vx++) {
      const cell = s.get(srcX0 + (vx - clip.x), srcY0 + (vy - clip.y));
      if (!cell || cell.width === 0) continue;           // skip wide continuation (PA-11)
      ctx.text(vx, vy, cell.char, { fg: cell.fg, bg: cell.bg, attrs: cell.attrs });
    }
  }
}
```

- **Wide-glyph blit (PA-11):** a `width:2` lead writes via `ctx.text` (occupies 2 view cells); the
  `width:0` continuation is skipped; a wide glyph straddling the clip's right edge is dropped whole by
  `ctx` (draw-context.ts:86-91). Cells are already sanitize-clean (03-01) so the blit carries nothing
  unsanitized (AC-13/AC-14).
- **Reads `surface.buffer` fresh each draw** — never caches — because `resize` swaps the buffer (PA-10).

## Passive / reactive behavior

- **Passive (AC-8):** `focusable = false`; **no** `onEvent` key/mouse handling — a dispatched
  arrow/PgDn does **not** move `delta`. TV `TSurfaceView` takes no input. Scrolling only by writing
  `delta`. A RD-11 `ScrollBar` bound to `delta` scrolls it (composition, demo/story).
- **Reactive (AC-5/AC-6):** `draw` reads `delta()`, `surfaceValue()`, and `version()` — RD-03 tracks
  all three, so a pan (`delta.set`), a surface swap, or a content bump each schedule **one** coalesced
  repaint per tick.
- **Options (PA-6):** `{ surface: Surface | null | Accessor<Surface|null>, delta?: Signal<Point>,
  onScroll?, ...layout }`; `delta` defaults to `signal({x:0,y:0})`.

## Should-Haves (PA-9)

- **`scrollTo(delta)` / `panBy(dx,dy)`** — write `delta.set(clampDelta(target, surface.size, viewSize))`
  (clamp from `surface-geometry.ts`); raw `delta.set` stays available for the faithful unclamped case.
- **`onScroll(delta)`** — invoked when `delta` changes (an effect on the `delta` signal), parallel to
  the other families' `onChange`.

## Security (AC-13)

`computeClip`/`marginRects` are integer, bounds-clamped; the blit indexes only `[srcX0, srcX0+clipW)` ×
`[srcY0, srcY0+clipH)` which `computeClip` guarantees ⊆ surface — verified for any `delta` (incl.
negative + fully-outside), any surface size, null surface, and a zero-size view. Every emitted glyph
and space is sanitize-clean.
