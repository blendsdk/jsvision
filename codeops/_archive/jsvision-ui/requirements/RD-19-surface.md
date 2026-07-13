# RD-19: Surface family — Surface + SurfaceView (decode-first from `TDrawSurface`/`TSurfaceView`)

> **Document**: RD-19-surface.md
> **Status**: Draft
> **Created**: 2026-07-05 (`add_requirement` — the last RD-12+ sibling, 6 of 6; the **Later** phase)
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-03 (View/Group spine — done; `View`/`Group`/`DrawContext`, `bind`/`invalidate`, the reflow pass), RD-04 (Event loop — done; the standard mount/dispatch path — SurfaceView is passive so it takes no keys, but it lives in the same tree), RD-01 (Reactive core — done; `Signal`/`computed` drive the `surface` + `delta` bindings), RD-02 (Layout engine — done; SurfaceView sizes/places via the standard box model), RD-05 (App shell — done; a `SurfaceView` mounts in a `Window`/`Dialog`/`Desktop`), `@jsvision/core` (done; the **`ScreenBuffer`** `render/buffer.ts` the `Surface` wraps, `sanitize`, and the `windowInactive` theme role the empty area reuses)
> **Set**: The RD-12+ high-value bucket (AR-125…AR-129) — 6 siblings by mechanism: RD-14 (Input dropdowns), RD-15 (Tree), RD-16 (Table/DataGrid), RD-17 (Tabs), RD-18 (Feedback), and **RD-19 (Surface)** — the **last** sibling and the **Later**-phase closer.
> **CodeOps Skills Version**: 3.3.0

---

## Feature Overview

A **surface family** for `@jsvision/ui`: an offscreen, freely-writable cell buffer (**`Surface`**)
plus a **`SurfaceView`** widget that displays a scrollable `delta`-offset **viewport** onto that buffer,
filling any out-of-bounds margin with an empty-area colour. Together they are the idiomatic way to render
**content larger than its viewport** in a TUI — a big ASCII diagram, a map/minimap, a game board, an
image preview, or a double-buffered off-screen render target — and pan a window over it.

**GATE-1 fidelity finding (`magiblot/tvision`).** Turbo Vision **does** have both classes to decode —
**`TDrawSurface`** (an offscreen `TScreenCell` buffer) and **`TSurfaceView : TView`** (the viewport
widget), defined in `include/tvision/surface.h` and implemented in `source/tvision/tsurface.cpp:74-160`.
So per the **NON-NEGOTIABLE TV-fidelity directive** the `SurfaceView`'s *drawing* is a **decode** of
`TSurfaceView::draw()`, not a design.

**Finding that supersedes the roadmap north-star.** The roadmap's aspirational demo was "clone
`tvdemo`," but a whole-tree search of `magiblot/tvision` shows **no bundled example** (`tvdemo`, `mmenu`,
`tvforms`, `tvedit`, `hello`, …) uses `TSurfaceView`/`TDrawSurface` — it is a general-purpose
offscreen-canvas primitive, not something `tvdemo` exercises. The demo is therefore **purpose-built**: a
pannable ASCII canvas (AR-229).

Decoded facts from `TDrawSurface` (`surface.h` + `tsurface.cpp:20-79`) and `TSurfaceView::draw()`
(`tsurface.cpp:74-160`), to be re-verified cell-by-cell at plan **GATE-1/GATE-2**:

| Piece | TV decode | `file:line` |
|-------|-----------|-------------|
| Buffer model | `TDrawSurface` holds a flat `TScreenCell *data` of `size.x*size.y`, indexed `data[y*size.x + x]` | `surface.h` (`data`/`at` inline), `tsurface.cpp:21-38` |
| Buffer API | `resize(size)` (realloc/zero-init) · `grow(delta)` = `resize(size+delta)` · `clear()` (memset 0) · `at(y,x)` — the header **explicitly warns "no bounds checking"** | `surface.h` (`grow`/`at` inline), `tsurface.cpp:40-75` |
| Viewport fields | `const TDrawSurface *surface` + `TPoint delta` — the view shows the surface region between `delta` and `{delta.x+size.x, delta.y+size.y}` | `surface.h` (field decls), ctor `tsurface.cpp:77-83` |
| Draw / clip | compute `clip = TRect(0,0,surface.size).move(-delta).intersect(viewExtent)`; blit the surface cells inside `clip`, fill the top/bottom/side margins with **spaces** | `tsurface.cpp:93-141` (clip `105-107`) |
| Empty area | out-of-bounds margins **and** a null `surface` (whole view) draw as whitespace in `mapColor(1)` — palette `cpSurfaceView "\x01"`, whose **1 entry maps to `TWindow`/`TDialog`'s "frame passive" colour** | `surface.h` (comment), `cpSurfaceView` `tsurface.cpp:19`, `mapColor(1)` `:98`, fill `:85-91,138-139` |
| Degenerate | `size.x<=0 \|\| size.y<=0` ⇒ draw nothing; `resize` with a non-positive dim frees the buffer (size 0) | `tsurface.cpp:40-70,95` |

**Behavior may extend TV** (wrapping core's richer `ScreenBuffer`, a `DrawContext` paint facade,
reactive `surface`/`delta`, bounds-checked accessors) but the **`SurfaceView` draw geometry — the
`delta`-offset clipped viewport and the empty-area whitespace fill — must match** `TSurfaceView::draw()`,
decoded/confirmed at plan GATE-1/GATE-2.

The components in scope:

| Component | Basis | Role |
|-----------|-------|------|
| `Surface` | **decode + reuse** — `TDrawSurface` (`tsurface.cpp`), wrapping core `ScreenBuffer` | An offscreen, freely-writable cell buffer of a fixed `size` (width × height), **wrapping `@jsvision/core`'s `ScreenBuffer`** (width-correct cells, `clone()`, and the full drawing API for free). Faithful `resize`/`grow`/`clear`/`at`, made **bounds-safe** (a documented security deviation from TV's "no bounds checking"). |
| `SurfaceView` | **decode** — `TSurfaceView` (`tsurface.cpp`) | A `View` displaying a `delta`-offset **viewport** onto a bound `Surface`: blits the visible region, fills the out-of-bounds margin (and a null surface) with the empty-area colour. **Passive/faithful** — no keyboard, not selectable; `delta` is a two-way `Signal` the caller drives (bind it to a `ScrollBar`, or set it from app logic). |

---

## Functional Requirements

### Must Have

#### `Surface` — the offscreen buffer, wrapping core `ScreenBuffer` (AR-226/AR-232, decode of `TDrawSurface`)
- A **`Surface`** holds a **fixed-size offscreen cell buffer** (`size: {x, y}` = width × height). It is
  implemented by **wrapping `@jsvision/core`'s `ScreenBuffer`** (`render/buffer.ts`) — inheriting its
  width-correct cells, bounds-checking (`inBounds`), `clone()`, and drawing helpers (`set`/`text`/
  `fillRect`/`box`/`shadow`) — **not** by re-implementing a bare `TScreenCell[]` array (DRY; no
  duplication of core's cell/width logic). *(AR-226)*
- **Faithful API surface** (decode of `TDrawSurface`, `tsurface.cpp:40-79`):
  - **`resize(size)`** — grow/shrink to a new width × height, preserving overlapping content where it
    still fits (a fresh `ScreenBuffer` + copy of the overlap; TV realloc'd + zero-initialised the tail).
  - **`grow(delta)`** — `resize(size + delta)` convenience (the inline `TDrawSurface::grow`).
  - **`clear()`** — reset every cell to a blank fill (the `memset 0` decode; jsvision blanks to a space
    in a caller-supplied or default style).
  - **`at(x, y)`** / cell read-write — access a single cell. **Two documented deviations from TV:**
    - **Coordinate order (consistency, PF-002):** TV's `at(int y, int x)` is `(y, x)` (row-major
      memory); jsvision's accessor is **`at(x, y)`** to match the wrapped `ScreenBuffer` and **every**
      jsvision drawing API (`set(x,y)`/`get(x,y)`/`fillRect(x,y,…)`/`ctx.text(x,y)`) — the TV-fidelity
      directive scopes fidelity to drawing geometry/glyphs/colour, not API argument order, so the house
      `(x, y)` convention wins here (called out loudly in the accessor's JSDoc).
    - **Bounds + sanitize (security, AR-232):** TV's `at()` is explicitly **unchecked**; jsvision's
      accessor is **bounds-checked** (an out-of-range `(x, y)` is a safe no-op / `undefined`, never an
      out-of-buffer read/write) **and any value written through it is sanitize-clean** — a write cannot
      store an unsanitized C0/DEL control byte (identical to the `set()`/`text()` write-time sanitize).
      This makes the `SurfaceView` blit safe **by construction** (PF-001): because no surface cell can
      hold a raw control byte, the faithful raw-cell blit stays both faithful **and** injection-safe.
- **Painting into the surface (AR-227):** the **primary** authoring API is a **`DrawContext` facade** —
  app code draws into the surface with the **same `ctx.text()`/`ctx.fillRect()`/`ctx.color(role)` idiom
  as `View.draw()`**, so the offscreen and on-screen drawing models are one and the same. The wrapped
  `ScreenBuffer` remains **accessible underneath** (raw `set`/`get`/`text` for callers who want it).
  **Every surface-mutation path — the facade, the raw `ScreenBuffer` `set`/`text`, and `at()` — routes
  through the RD-03 `sanitize` boundary at write time** (core's `ScreenBuffer.set`/`text` already turn a
  C0/DEL into a space), so surface cells are always sanitize-clean; the `SurfaceView`'s later cell blit
  therefore carries nothing unsanitized to the screen. *(PF-001; theme + caps the facade needs are
  covered in the Technical Requirements below, PF-004.)*
- **Reactivity (AR-234):** a `SurfaceView`'s bound `surface` and `delta` are **`Signal`s** — mutating the
  surface's contents (or swapping the surface) and panning `delta` **invalidate** the view and schedule a
  coalesced repaint via the RD-03 mechanism. *(A content mutation exposes an explicit `invalidate()`/
  version bump so a same-identity in-place edit still repaints — pinned at plan time.)*

#### `SurfaceView` — the scrollable viewport (AR-228/AR-230, decode of `TSurfaceView`)
- A **`View`** (RD-03) that displays a **`delta`-offset region** of a bound `Surface`. **Passive/faithful
  (AR-228):** it is **not focusable** and handles **no keyboard** — exactly TV's `TSurfaceView`. Scrolling
  is driven by writing **`delta`** (a two-way `Signal`); the caller binds `delta` to a `ScrollBar`'s value,
  or sets it from application logic. *(Built-in keyboard/wheel scroll and auto `Scroller`/`ScrollBar`
  integration are **deferred**, DEF-31.)*
- **Draw geometry (faithful, `tsurface.cpp:97-140`):** compute the clip rectangle
  `clip = surfaceRect.move(-delta.x, -delta.y) ∩ viewExtent`; **blit** the surface cells that fall inside
  `clip` into the view (at view-local coordinates), and **fill** the top, bottom, and side **margins**
  (the parts of the view not covered by the surface) with the **empty-area colour** (whitespace). This is
  matched cell-for-cell to the decode at plan GATE-1/GATE-2.
- **Empty area + null surface (faithful, `tsurface.cpp:98,138-139`):** when the viewport extends beyond
  the surface, or the bound `surface` is **null**, the uncovered region is painted as **spaces** in the
  **empty-area role** — TV's `mapColor(1)` = "frame passive". In jsvision this **reuses the existing
  `windowInactive` role** (the passive-frame colour, `0x17` lightGray-on-blue), **0 new core roles**
  (exact fg/bg pinned at plan GATE-1). **Documented simplification (PF-003):** TV's `mapColor(1)` is
  **owner-relative** — the header notes it maps to "**TWindow's *and* TDialog's** frame passive colour",
  so a `TSurfaceView` inside a gray `TDialog` would tint the empty area gray, not blue. jsvision uses the
  single fixed `windowInactive` (faithful for a `SurfaceView` in a blue `Window`; a surface hosted in a
  gray `Dialog` shows the blue passive tint, not the dialog's). Accepted as a scoped deviation for MVP
  (surface-in-dialog is rare, this is the **Later** phase) so "0 new roles" stays an *informed* choice; an
  owner-derived empty-area role is a clean additive follow-up if a real need appears. *(AR-231)*
- **Degenerate (faithful):** a zero-or-negative view size draws nothing; a zero-size `Surface` shows an
  all-empty viewport; `delta` values that push the surface fully outside the viewport show an all-empty
  viewport — all without crash or out-of-range indexing.

#### Theme roles — none new (AR-231)
- The `SurfaceView`'s **cells are the surface's own cells** (whatever the app drew — arbitrary colours),
  **not** theme roles; the only themed surface is the **empty-area margin**, which **reuses the existing
  `windowInactive` role** (TV's frame-passive decode). **RD-19 adds 0 new core theme roles** (the exact
  reused role pinned at plan GATE-1). Additive, non-breaking. *(The single fixed `windowInactive` is a
  documented simplification of TV's owner-relative `mapColor(1)` — see the `SurfaceView` empty-area bullet
  above, PF-003.)*

#### Kitchen-sink story + headless demo (AR-229)
- Per the **kitchen-sink showcase (NON-NEGOTIABLE)** rule, add a **`SurfaceView` story** (category
  `Surface`) — a **pannable ASCII canvas**: an offscreen `Surface` **larger than its viewport** holding an
  ASCII-art/diagram, a `SurfaceView` showing a window onto it, and a visible `delta` echo — passing the
  headless smoke test, plus a headless **`demo:surface`** walkthrough (dispatch-driven, an ASCII frame per
  step: render the viewport → pan right (`delta.x++`) → pan down (`delta.y++`) → pan past an edge to reveal
  the empty-area fill → recentre), matching `demo:color`/`demo:date`/`demo:tabs`. Because no bundled TV
  example uses Surface, this purpose-built canvas is the north-star (superseding the roadmap's aspirational
  "clone `tvdemo`").

### Should Have
- **`SurfaceView.scrollTo(delta)` / `panBy(dx, dy)`** convenience methods that clamp `delta` to a sane
  range (`[0, max(0, surface.size − view.size)]`) so a caller-driven pan can't run the viewport off into
  unbounded empty space (opt-in; the raw `delta` signal stays writable for the faithful unclamped case).
- **`onScroll(delta)`** callback fired when `delta` changes (parallels the other families' `onChange`).
- **`Surface.from(rows)` / snapshot helpers** — construct a `Surface` from ASCII lines (a convenience for
  the demo and for static content), and expose `Surface.snapshot()` via the wrapped `ScreenBuffer.clone()`
  (double-buffering / off-screen render-target use).

### Won't Have (Out of Scope) — and Deferred (tracked)

**Out of scope (this RD):**
- **Built-in keyboard/wheel scrolling on `SurfaceView`** — TV's `TSurfaceView` is passive; RD-19 stays
  faithful (deferred, DEF-31).
- **Auto `Scroller`/`ScrollBar` integration** (auto-owned bars around the surface) — the caller composes a
  `ScrollBar` bound to `delta` if wanted; a bundled scroll-chrome variant is deferred (DEF-31).
- **The full editor tier** (`TEditor`/`TMemo`) — a distinct, much larger feature (RD-08); `Surface` is a
  passive canvas, not a text editor.
- **A drawing/graphics DSL** (lines, shapes, sprites beyond the `DrawContext` cell primitives) — out of
  scope; the surface is a cell buffer, drawn with the existing `DrawContext` API.
- **Persistence / image import-export** (loading a PNG/sixel into a surface) — out of scope for a
  cell-buffer primitive.

**Deferred (tracked) — explicit register so nothing is lost (AR-99 convention):**

| Deferred item | From decision | Target | Rationale |
|---------------|---------------|--------|-----------|
| Built-in keyboard/wheel scroll on `SurfaceView` (focusable + arrows/PgUp/PgDn/Home/End/wheel move `delta`) | AR-228 (DEF-31) | later | A documented extension beyond passive `TSurfaceView`; the faithful core ships first, the interactive variant is a clean additive follow-up. |
| Auto `Scroller`/`ScrollBar` integration (a scroll-chrome wrapper binding bars ↔ `delta`) | AR-228 (DEF-31) | later | Composable from RD-11 `ScrollBar` + `delta` today; a bundled convenience wrapper is a separable enhancement. |

---

## Technical Requirements

### New subsystem (AR-233)
- One new subsystem dir **`packages/ui/src/surface/`** (dir-per-concern, AR-133/148/160/181/193/208/218):
  `surface.ts` (the `Surface` buffer — wraps core `ScreenBuffer`; `resize`/`grow`/`clear`/`at` + the
  `DrawContext` paint facade), `surface-view.ts` (the `SurfaceView` `View` — the faithful `delta`-viewport
  draw + empty-area fill), one barrel `index.ts`; per-file ≤ 500 lines. **Explicit named re-exports** from
  `src/index.ts` (the layout-convention rule). *(Exact file split confirmed at plan time.)*
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`check:deps` holds).
- **Paint-facade theme/caps seam (PF-004):** the `DrawContext` facade over the surface is built with
  `makeDrawContext(buffer, viewRect, clip, theme, caps)` (RD-03, `draw-context.ts`), so an **offscreen**
  paint (before/independent of a render root) needs a `theme` + `caps`. The `Surface`'s facade
  **takes/binds a `theme` + `caps`** (defaulting to core's `defaultTheme` + a mono/ASCII-safe caps
  profile) so `ctx.color(role)` is well-defined even when the surface isn't yet mounted; the exact seam
  (per-`getDrawContext()` argument vs. captured-at-construction) is pinned at plan time.

### Cross-package + cross-RD edits (additive only)
- **`@jsvision/core`:** **0 new theme roles** (the empty area reuses `windowInactive`, AR-231) and **no
  existing export changes**. The `Surface` wraps core's already-public **`ScreenBuffer`** (`render/index.ts`
  → `engine/index.ts`) — reuse, not a new primitive. *(If plan GATE-1 finds a genuinely-needed additive
  seam on `ScreenBuffer` — e.g. a `resize` helper it lacks today — it is added additively and pinned then;
  the current expectation is a UI-side wrapper that allocates a new `ScreenBuffer` on `resize`.)*
- **No `dropdown/` / no other subsystem edits** — RD-19 is self-contained (unlike RD-20/21, it does not
  touch the anchored popup).

### Reuse (no new engine primitives)
- **Cell buffer (core):** the `Surface` wraps `ScreenBuffer` — width-correct cells, bounds-checking,
  `clone()`, `set`/`get`/`text`/`fillRect`/`box`/`shadow`. The surface never reimplements cell/width math.
- **Draw + sanitize (RD-03/core):** `SurfaceView.draw()` blits cells and fills margins via the RD-03
  `DrawContext` → `ScreenBuffer` + core **`sanitize`** boundary — no raw escape sequence reaches the
  terminal; the paint facade over the surface uses the same path.
- **Reactivity (RD-01/RD-03):** `Signal`/`computed` drive `surface` + `delta`; RD-03 `bind`/`invalidate`
  coalesce repaints.
- **Layout (RD-02):** `SurfaceView` sizes/places through the standard box model (fixed/fr/auto), like any
  `View`.
- **Empty-area colour (core):** the existing `windowInactive` theme role (the passive-frame decode).

---

## Integration Points

- **View/Group + reactivity (RD-03/RD-01):** `SurfaceView` is a `View`; `Surface` is a plain reactive
  buffer bound into it. No new tree mechanics.
- **Core render (`@jsvision/core`):** `Surface` wraps `ScreenBuffer`; the empty area reuses
  `windowInactive`; all output is sanitized.
- **Containers (RD-11):** a `SurfaceView`'s `delta` can be **bound to a `ScrollBar`'s value** for
  caller-composed scrolling (the faithful, un-bundled path); a `Scroller` wrapper is deferred (DEF-31).
- **App shell (RD-05):** a `SurfaceView` mounts in a `Window`/`Dialog`/`Desktop` like any view.
- **Kitchen-sink (examples):** a `SurfaceView` **pannable ASCII canvas** story + `demo:surface`.

---

## Scope Decisions

All decisions trace to the Ambiguity Register (`00-ambiguity-register.md`):

- **AR-225** — RD-19 is **decode-first**: Turbo Vision **has** both `TDrawSurface` and `TSurfaceView`
  (`surface.h` + `tsurface.cpp`), so the `SurfaceView` drawing is a **decode**. **No bundled TV example
  uses them** (whole-tree search), so the demo is **purpose-built** (superseding the roadmap's "clone
  `tvdemo`").
- **AR-226** — the **`Surface` wraps core `ScreenBuffer`** (width-correct cells, `clone()`, drawing API
  for free), **not** a bare re-implemented cell array.
- **AR-227** — the primary paint API into the surface is a **`DrawContext` facade** (same idiom as
  `View.draw()`); the raw wrapped `ScreenBuffer` stays accessible underneath.
- **AR-228** — `SurfaceView` is a **passive, faithful viewport**: not focusable, no keys, `delta` a
  two-way `Signal` the caller drives (bind to a `ScrollBar`). **Built-in scroll + auto `Scroller`/
  `ScrollBar` are DEFERRED** (DEF-31).
- **AR-229** — the demo/story is a **pannable ASCII canvas** (an offscreen `Surface` larger than its
  viewport, panned via `delta`), showing viewport clipping + empty-area fill; kitchen-sink `SurfaceView`
  story + headless `demo:surface`.
- **AR-230** — `SurfaceView.draw()` geometry is **faithful to `TSurfaceView::draw()`** (`tsurface.cpp:97-140`):
  the `delta`-offset clip + blit + margin whitespace fill (+ null-surface all-empty), pinned at plan
  GATE-1/GATE-2.
- **AR-231** — the empty area **reuses the existing `windowInactive` role** (TV's frame-passive
  `mapColor(1)`); cells are the surface's raw colours; **0 new core theme roles** (exact reused role pinned
  at plan GATE-1). *(PF-003: the single fixed role is a documented simplification of TV's owner-relative
  `mapColor(1)` — faithful for a `Window` host, blue tint for a `Dialog` host; owner-derived role deferred.)*
- **AR-232** — the `Surface` API is **faithful (`resize`/`grow`/`clear`/`at`)** but its accessor is
  **bounds-checked** and **sanitize-clean on write** — deliberate, documented security deviations from
  TV's explicitly-unchecked `at()` (PF-001/AC-14). *(PF-002: the accessor also flips to the house `(x, y)`
  order — TV's row-major `at(y, x)` becomes jsvision `at(x, y)` to match `ScreenBuffer` + every draw API.)*
- **AR-233** — new `src/surface/` subsystem named **`Surface`** + **`SurfaceView`**, explicit named
  re-exports.
- **AR-234** — `surface` + `delta` are **`Signal`s** so content writes and pans invalidate + repaint via
  the RD-03 coalescing scheduler.

> **Traceability:** AR-226/227/228/229 are explicit user choices (RD-19 `add_requirement` gate,
> 2026-07-05); AR-225/230/231/232/233/234 are source-determined or single-dominant decisions (the GATE-1
> finding, the faithful draw geometry, the passive-frame reuse, the security-mandated bounds check, and the
> house subsystem/reactivity patterns) recorded for traceability.

---

## Security Considerations

> RD-19 adds an **offscreen cell buffer + a viewport widget** over the existing in-process TUI. No network,
> no persistence, no new untrusted external surface. The input boundaries are app draws → surface cells →
> screen, and `delta` writes → viewport offset:
- **Every surface-mutation path sanitizes at write time** — the `DrawContext` facade, the raw
  `ScreenBuffer` `set`/`text`, and `Surface.at()` writes all route through the RD-03 **`sanitize`**
  boundary (core's `ScreenBuffer.set`/`text` turn a C0/DEL into a space cell). So surface cells are always
  sanitize-clean, and the `SurfaceView`'s faithful raw-cell blit carries **no raw escape sequence** to the
  terminal, whatever the app wrote into the surface (PF-001/AC-14).
- **`Surface.at()` and all surface writes are bounds-checked** (the AR-232 deviation from TV's unchecked
  `at()`) — an out-of-range `(x, y)` is a safe no-op, never an out-of-buffer read/write, for any surface
  size (including a zero/degenerate surface).
- The `SurfaceView` **clip math** (`surfaceRect.move(-delta) ∩ viewExtent`, the blit region, and every
  margin fill) is **bounds-checked/clamped** to the view extent and the surface size — no out-of-range
  indexing for any `delta` (including deltas that push the surface fully outside the viewport), any surface
  size, a null surface, or a zero-size view.
- `onScroll`/callbacks are caller-supplied and invoked only on a `delta` change; no surface content is
  interpreted as code.

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test will encode. The `SurfaceView` fidelity ACs (AC-3 draw
geometry, AC-4 empty area) diff against the **`TSurfaceView::draw()` decode** (`tsurface.cpp:93-141`),
pinned at plan GATE-1/GATE-2; the extension ACs encode the `ScreenBuffer`-wrapping / paint-facade /
reactive-pan behavior.

- **AC-1** (Surface buffer + faithful API) — a `Surface({x:W, y:H})` exposes `resize`/`grow`/`clear`/`at`;
  `grow(d)` equals `resize(size+d)`; `clear()` blanks every cell; after `resize` the overlapping prior
  content is preserved and the new region is blank. The buffer is backed by a core `ScreenBuffer` (verified
  via reuse of its cell/width behavior, e.g. a wide glyph occupies two cells). *(AR-226/AR-232)*
- **AC-2** (bounds-safe accessor — security deviation) — `Surface.at(x, y)` (house `(x, y)` order,
  PF-002) and any write for an out-of-range `(x, y)` is a **safe no-op / `undefined`**, never an
  out-of-buffer access, for any surface size including a zero/degenerate one. *(AR-232; PF-002; security
  standard)*
- **AC-3** (SurfaceView draw geometry, faithful) — a `SurfaceView` of size `Vw×Vh` bound to a `Surface`
  of size `Sw×Sh` with a given `delta` blits exactly the surface cells in
  `clip = Rect(0,0,Sw,Sh).move(-delta) ∩ Rect(0,0,Vw,Vh)` into the corresponding view-local cells, matched
  against the buffer pre-`serialize` to the `tsurface.cpp:93-141` decode. *(AR-230)*
- **AC-4** (empty-area + null surface, faithful) — the parts of the viewport not covered by the surface
  (top/bottom/side margins, and the **whole** view when `surface` is null) are drawn as **spaces** in the
  **`windowInactive` role** (TV's frame-passive `mapColor(1)`, hosted in a `Window`; the single fixed role
  is a documented simplification of TV's owner-relative resolution, PF-003); no non-space glyph appears in
  a margin. *(AR-230/AR-231; PF-003)*
- **AC-5** (reactive pan) — writing a new `delta` (a `Signal`) moves the viewport and triggers exactly one
  coalesced repaint via the RD-03 scheduler; the newly-revealed surface region appears and the vacated
  region is replaced (by surface content or empty-area fill). *(AR-234)*
- **AC-6** (reactive content) — mutating the surface's contents (via the paint facade or the raw
  `ScreenBuffer`) and signalling the change invalidates the bound `SurfaceView` and repaints the visible
  region on the next tick. *(AR-234)*
- **AC-7** (paint facade) — drawing into the surface with the `DrawContext` facade (`ctx.text`/
  `ctx.fillRect`/`ctx.color(role)`) produces the same cells as the equivalent raw `ScreenBuffer` calls, and
  the raw buffer remains accessible underneath. *(AR-227)*
- **AC-8** (passive — no keyboard/focus) — a `SurfaceView` is **not focusable** and consumes **no**
  key/mouse events (a dispatched arrow/PgDn does not move `delta`); scrolling happens only by writing
  `delta`. A `ScrollBar` bound to `delta` scrolls the viewport (composition, not built-in). *(AR-228)*
- **AC-9** (degenerate / edge) — a zero-or-negative-size `SurfaceView` draws nothing; a zero-size
  `Surface`, and a `delta` that pushes the surface fully outside the viewport, both render an all-empty
  viewport — all without crash or out-of-range indexing. *(AR-230; edge case)*
- **AC-10** (theme roles) — the surface cells render as their own colours (no theme role); the empty area
  reuses a passive-frame role (`windowInactive` for the window case — a documented simplification of TV's
  owner-relative `mapColor(1)`, PF-003); **no new core theme role exists** and no existing role changes;
  `encode()` of the reused role does not throw. *(AR-231; PF-003)*
- **AC-11** (packaging) — the surface family lives in `packages/ui/src/surface/` with explicit named
  re-exports from `src/index.ts`; `yarn check:deps` passes (zero runtime deps); files ≤ 500 lines; **no
  existing `@jsvision/core` export changes** (the `Surface` reuses the already-public `ScreenBuffer`).
  *(AR-233)*
- **AC-12** (story + demo) — a `SurfaceView` kitchen-sink story (category **`Surface`**; a pannable ASCII
  canvas larger than its viewport, with a visible `delta` echo) passes the headless smoke test;
  **`demo:surface`** runs headless with an ASCII frame per step (render → pan right → pan down → pan past
  an edge to reveal the empty-area fill → recentre). *(AR-229)*
- **AC-13** (security) — every blitted cell and empty-area space reaches the screen sanitize-clean;
  `Surface.at()` / writes and the `SurfaceView` clip math are bounds-checked/clamped for any surface size,
  any `delta`, a null surface, and a zero-size view. *(security standard)*
- **AC-14** (sanitize on mutation — PF-001) — **no surface-mutation path can store an unsanitized control
  byte**: the `DrawContext` facade, the raw `ScreenBuffer` `set`/`text`, and `Surface.at()` writes all
  route through the RD-03 write-time `sanitize` boundary (a C0/DEL becomes a space cell), so a raw
  control sequence written into the surface (e.g. `at(x,y) = '\x1b[2J'`) never survives as a cell — and
  the `SurfaceView`'s faithful raw-cell blit therefore carries nothing unsanitized to the terminal.
  *(PF-001; security × TV-fidelity)*

---

> **Next step:** run the make_plan skill on RD-19 (spec-first: spec oracles RED → implement → GREEN → impl
> tests). Because `SurfaceView`/`Surface` **have a TV counterpart** (GATE-1), the plan's GATE-1/GATE-2 work
> is mandatory: **decode `TSurfaceView::draw()` + `TDrawSurface` cell-by-cell** (`tsurface.cpp:20-160` — the
> `delta`-offset clip `surfaceRect.move(-delta) ∩ viewExtent`, the blit, the margin whitespace fill, the
> null-surface all-empty case, and the `resize`/`grow`/`clear`/`at` buffer API), **pin the reused
> `windowInactive` empty-area role** (0 new roles), and record the decode + the two BEFORE/AFTER gate tasks
> in `99-execution-plan.md`; the `ScreenBuffer`-wrapping / paint-facade / reactive-pan / bounds-check
> extensions get spec oracles but no diff. RD-19 is **self-contained** (no popup/dropdown edit) — it can be
> sequenced independently of the other RD-12+ siblings. It is the **last** of the six RD-12+ siblings.
