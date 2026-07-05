# 03-01 — `Surface` buffer + `surface-geometry.ts` (pure)

> **Document**: 03-01-surface.md · **Parent**: [Index](00-index.md)
> **Covers**: AC-1, AC-2, AC-6, AC-7, AC-13, AC-14 · **AR**: PA-1/2/4/5/7/8/10/11
> **CodeOps Skills Version**: 3.3.0

Two files: the **pure** `surface-geometry.ts` (view-free clip/margin math, oracle-first) and
`surface.ts` (the `Surface` buffer wrapping core `ScreenBuffer`). `SurfaceView` (03-02) consumes both.

---

## `surface-geometry.ts` — pure clip & margin math (PA-7)

View-free, zero-dep helpers so `SurfaceView.draw` stays thin and the geometry is unit-testable against
the `tsurface.cpp` decode without a render root. Mirrors `color-grid.ts`/`calendar-grid.ts`.

```ts
export interface Point { x: number; y: number; }
export interface Rect { x: number; y: number; width: number; height: number; }

/**
 * The clip rectangle (view-local) where the surface is drawn — the faithful
 * `TRect(0,0,surface.size).move(-delta).intersect(viewExtent)` (tsurface.cpp:105-107),
 * expressed as {x,y,width,height}. Empty (width≤0 or height≤0) ⇒ the surface is fully outside
 * the viewport (PA-3): the caller fills the whole view with the empty-area colour.
 */
export function computeClip(surface: Point, delta: Point, view: Point): Rect;

/**
 * The empty-area margin rects (view-local) NOT covered by `clip`, in the TV fill order
 * (tsurface.cpp:118-132): top band, bottom band, then the left & right side bands within the
 * surface rows. Returns [] when clip === full view (surface fills the extent — no margins).
 * The caller fills each with a space in `windowInactive`.
 */
export function marginRects(clip: Rect, view: Point): Rect[];

/** Clamp a delta to [0, max(0, surface−view)] per axis (Should-Have scrollTo/panBy, PA-9). */
export function clampDelta(delta: Point, surface: Point, view: Point): Point;
```

**Decode mapping (GATE-1):** `computeClip` = `move(-delta).intersect(extent)`; the empty-clip case
(width/height ≤ 0) corresponds to TV's `0 <= clip.a.x < clip.b.x` guard failing (`:108-109`).
`marginRects` reproduces the `writeLine(top)` + `writeLine(bottom)` + side-band fills (`:120-132`).
All math is integer, bounds-clamped; no indexing.

---

## `surface.ts` — the `Surface` buffer

### Shape (PA-10 composition)

```ts
export interface SurfaceOptions {
  size: Point;                        // {x: width, y: height}
  theme?: Theme;                      // facade default (PA-4); defaults to core defaultTheme
  caps?: CapabilityProfile;           // facade default; defaults to a mono/ASCII-safe profile
  fill?: Style & { char?: string };   // initial cell fill; defaults to a space in default style
}

export class Surface {
  private buf: ScreenBuffer;          // the wrapped core buffer (swapped on resize)
  private readonly _version = signal(0);
  size: Point;                        // current {x,y}; mirrors buf.width/height
  // ...theme + caps captured from options...

  constructor(opts: SurfaceOptions);
  static from(rows: readonly string[], opts?: Omit<SurfaceOptions,'size'>): Surface;  // PA-9

  get buffer(): ScreenBuffer;         // raw escape hatch (AR-227) — stays accessible

  // Faithful TDrawSurface API (decode + extension) --------------------------
  resize(size: Point): void;          // fresh ScreenBuffer + copy overlap (PA-2); swaps buf; bumps version
  grow(delta: Point): void;           // = resize({x:size.x+delta.x, y:size.y+delta.y})  (surface.h:39-42)
  clear(style?: Style): void;         // blank every cell to a space in style (PA-8); bumps version

  // Cell access (PA-1 read/write split) -------------------------------------
  at(x: number, y: number): Readonly<Cell> | undefined;   // READ ONLY; OOB → undefined
  set(x: number, y: number, char: string, style: Style): void; // delegates to buf.set (sanitize+bounds); bumps version

  // Paint facade (AR-227, PA-4) ---------------------------------------------
  getDrawContext(overrides?: { theme?: Theme; caps?: CapabilityProfile }): DrawContext;

  // Reactivity (PA-5) -------------------------------------------------------
  version(): number;                  // reactive read; SurfaceView.draw tracks it
  invalidate(): void;                 // manual bump (for raw-buffer pokes)
  snapshot(): ScreenBuffer;           // = buf.clone()  (PA-9)
}
```

### Behaviors

- **Construction** — `size` clamped like `ScreenBuffer` (≥1, floored); `theme`/`caps` captured
  (defaults `defaultTheme` + a mono/ASCII-safe caps profile so offscreen `ctx.color(role)` resolves,
  PA-4). `from(rows)` sizes to `max(rowWidth) × rows.length` (display-width aware) and `text`s each row.
- **`resize(size)` (PA-2, AC-1)** — allocate a **new** `ScreenBuffer(size.x, size.y, fill)`; copy the
  overlapping region `[0, min(oldW,newW)) × [0, min(oldH,newH))` cell-by-cell from the old buffer (read
  `old.get`, write `new` via its own `set`/an internal blit that preserves style+width); swap `buf`;
  update `size`; **bump version**. A non-positive dim clamps to 1 (never frees to an unusable state).
  *Deviation from TV recorded in JSDoc: `TDrawSurface::resize` `memset 0`s the whole buffer
  (`tsurface.cpp:60`) — jsvision preserves overlap.*
- **`at(x,y)` (PA-1, AC-2)** — bounds-check; OOB → `undefined`; else return a **readonly** cell. To keep
  it allocation-cheap and immutable, return a frozen shallow copy (or a `Readonly<Cell>` cast over a
  copy) — **never** the live `buf.get()` handle, so no caller can mutate a cell around the sanitize
  boundary.
- **`set(x,y,char,style)` (PA-1, AC-14)** — delegate to `buf.set` (bounds-checked no-op OOB;
  sanitizes C0/DEL → space); bump version. This is the **single-cell write path** (there is no
  cell-mutation via `at`).
- **`getDrawContext(overrides?)` (PA-4, AC-7)** — `makeDrawContext(buf, {x:0,y:0,...size}, fullClip,
  overrides?.theme ?? theme, overrides?.caps ?? caps)`. Same idiom as `View.draw`; its `text`/`fillRect`
  writes route through `buf` + `sanitize`. **Facade writes must bump version** — wrap the returned
  context so its mutating writers bump (or expose a `commit()`); pinned in impl to bump on any facade
  write so AC-6 holds for facade paints too.
- **`clear`/`grow`/`from`** — all bump version.
- **`version()`/`invalidate()` (PA-5)** — `version()` reads the signal (tracked by `SurfaceView.draw`);
  `invalidate()` bumps it. Bumps are cheap ints; RD-03 coalesces many bumps in one tick to one repaint.

### Security (AC-13/AC-14)

- Every write path — `set`, `text`(via facade), `fillRect`(via facade), `from` — routes through
  `ScreenBuffer.set`/`text` which sanitize at write time. `at` is read-only. ⇒ **no surface cell can
  hold an unsanitized control byte**, so 03-02's faithful raw-cell blit is safe by construction (PA-1).
- All indexing is bounds-checked (`buf` clamps; `at` guards; `resize` overlap loop clamps to
  `min` dims). A zero/degenerate surface never indexes out of range.
