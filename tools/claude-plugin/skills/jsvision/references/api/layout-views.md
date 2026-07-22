<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->

# API — Layout & view system

The `col`/`row`/`stack` DSL, `View`/`Group`, layout props, and the render root.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## Align

Cross-axis alignment of children (like CSS `align-items`).

```ts
type Align = 'start' | 'center' | 'end' | 'stretch'
```

## AppEvent

Any event the loop dispatches: a decoded terminal input event or an internal command.

```ts
type AppEvent = InputEvent | CommandEvent
```

## apportion

Distribute `total` integer cells across weighted shares so the result sums to `total` **exactly**.

```ts
apportion(total: number, weights: readonly number[]): number[]
```

## at

Place a view absolutely at a parent-content-relative rectangle, and return the same view for inline composition.

```ts
at<V extends View>(view: V, ...spec: [x: number, y: number, width: number, height: number] | [rect: Rect]): V
```

## bottomRight

Tag a view as a fixed-size stack layer pinned to the **bottom-right** corner.

```ts
bottomRight<V extends View>(view: V, width: number, height: number): V
```

## center

Center a fixed-size view in its parent as an out-of-flow overlay, re-centering on resize, and return the same view — standalone, no `stack()` wrapper.

```ts
center<V extends View>(view: V, width: number, height: number): V
```

## centered

Tag a view as a centered fixed-size stack layer (`width × height`, centered on both axes).

```ts
centered<V extends View>(view: V, width: number, height: number): V
```

## col

Build a **vertical** flex container (`direction: 'col'`) — children stack top to bottom.

```ts
col(...args: [Flex, ...Child[]] | Child[]): Group
```

## CommandEvent

A typed command raised within the app (e.g. from a button or menu) and routed to handlers.

```ts
interface CommandEvent {
  type: 'command';   // Discriminant tag.
  command: string;   // The command name, compared by equality, e.g. `'ok'` | `'cancel'` | `'quit'`.
  arg?: unknown;   // Optional payload carried with the command.
}
```

## contains

Test whether a point lies inside a rect.

```ts
contains(r: Rect, p: Point): boolean
```

## cover

Make a view cover its parent's whole content box as an out-of-flow overlay, and return the same view — standalone, no `stack()` wrapper.

```ts
cover<V extends View>(view: V): V
```

## createRenderRoot

Create a render root over a `size`-cell buffer, ready to mount and render a view tree.

```ts
createRenderRoot(size: Size2D, opts: RenderRootOptions): RenderRoot
```

## Direction

The main axis of a container: `row` = horizontal, `col` = vertical.

```ts
type Direction = 'row' | 'col'
```

## DispatchEvent

The envelope wrapped around each event before it is routed to views.

```ts
interface DispatchEvent {
  event: AppEvent;   // The wrapped decoded input event or internal command.
  handled: boolean;   // Set `true` by a handler to stop the event propagating to the remaining phases/views.
  local?: Point;   // Mouse/wheel coordinates translated to this view's local cells; absent for keys and commands.
  clickCount?: number;   // For a mouse-down, how many consecutive clicks landed on the same cell (1 = single, 2 = double, 3 = triple…). Present only on a mouse-down during real dispatch; `undefined` otherwise. A row widget that activates on double-click checks `ev.clickCount === 2`.
  emit?: (command: string, arg?: unknown) => void;   // Raise a typed command onto the current dispatch tick — how a widget signals an action (e.g. a button emitting `'ok'`) for a menu/status/app handler to pick up.
  focusView?: (view: View) => void;   // Move focus to another view — used e.g. by a `Label` to focus the control it labels. A non-focusable target is a no-op.
  setCapture?: (view: View) => void;   // Capture the pointer to `view`: while captured, all mouse/wheel events route to `view` until releaseCapture. Used for drag gestures such as dragging a scrollbar thumb.
  releaseCapture?: () => void;   // Release the pointer capture; a no-op if none is set. Pairs with setCapture.
  hasCapture?: (view: View) => boolean;   // Whether `view` currently holds the pointer capture. A view mid-gesture (a window drag, a status press) checks this before applying a move, so if the capture was lost externally (a modal opened or closed mid-drag) the gesture aborts cleanly instead of jumping to the cursor.
  setClipboard?: (text: string) => void;   // Write `text` to the system clipboard — used by `Input` copy/cut. A no-op when the terminal has no clipboard support; the control never touches I/O directly.
  readClipboard?: () => string;   // Read the application's in-app clipboard buffer (the last text copied or cut within the app). Used by editable controls for in-app paste without reading the external OS clipboard. Returns `''` when nothing has been copied yet, and is `undefined` on an event that was not routed through the loop (e.g. one constructed directly in a test) — always call it optional-chained.
  getFocused?: () => View | null;   // The currently-focused view. A dropdown control saves it before opening its popup and restores it on dismiss.
  popupHost?: PopupHost;   // The overlay host a dropdown control mounts its anchored popup into. Present when an app shell (or a `Dialog`) has provided one; `undefined` in a headless/no-shell setup.
}
```

## DrawContext

The stateless, view-local, auto-clipped paint API handed to `View.draw(ctx)`.

```ts
interface DrawContext {
  text(x: number, y: number, str: string, style?: Style): void;
  fillRect(x: number, y: number, w: number, h: number, char: string, style?: Style): void;
  fill(char: string, style?: Style): void;   // Fill the whole view rect.
  box(x: number, y: number, w: number, h: number, style?: Style, title?: string): void;
  shadow(x: number, y: number, w: number, h: number, style?: Style): void;
  color(role: ThemeRoleName): Style;   // Resolve a named theme role to a `Style` (foreground/background).
  role(name: K): Theme[K];   // Resolve a named theme role to its **full** role object, including extras that color drops (a desktop background `pattern` glyph, a window's `border`/`title` colors). Chrome widgets use this; the generic `K` keeps `role('window').border` type-safe with no cast.
  size: Size2D;   // The view's content size, in cells.
  caps: CapabilityProfile;   // The resolved terminal capabilities for this frame. Read `caps.glyphs`/`caps.unicode` at draw time to pick an ASCII vs. Unicode glyph form (e.g. a progress bar's `#`/`-` fallback on a terminal that can't render block characters). This is the same capability profile the renderer encodes with, so your glyph choice and the renderer's fallback always agree.
  revealAccelerators: boolean;   // Whether the accelerator (hotkey) overlay is revealed this frame. While `true`, a widget that draws a `~X~` hotkey should underline the hot glyph so every reachable shortcut lights up at once. The render root toggles it via `setRevealAccelerators` and clamps it to the active dispatch scope, so a background window behind a modal draws it as `false`. Default `false`; widgets that ignore it are unaffected.
}
```

## fixed

Give a view a fixed size of `n` cells along its container's main axis (columns in a `row`, rows in a `col`).

```ts
fixed<V extends View>(view: V, n: number): V
```

## Flex

Container props for col/row: every LayoutProps field except `direction` (the builder sets that), plus size shorthands and a `background` role.

```ts
type Flex = Omit<LayoutProps, 'direction'> & {
  /**
   * Flex-grow weight — shorthand for `size: { kind:'fr', weight }`. The object form adds a `min`
   * cell floor: `{ weight, min }` → `{ kind:'fr', weight, min }` (the box never solves below `min`).
   */
  grow?: number | { weight: number; min?: number };
  /** Fixed cell count — shorthand for `size: { kind:'fixed', cells }`. */
  fixed?: number;
  /** Take a flex share of `1` — shorthand for `size: { kind:'fr', weight:1 }`. */
  fill?: boolean;
  /** Theme role filled behind the children before they paint. */
  background?: ThemeRoleName;
}
```

## Group

A retained container of child views.

```ts
new Group()   // extends View
// methods & signals:
children: View[]
background?: ThemeRoleName
add(child: View): void
remove(child: View): void
addDynamic(build: DynamicBuilder): void
```

## grow

Give a view a flex-grow size: it takes a share of the container's leftover main-axis space proportional to `n`.

```ts
grow<V extends View>(view: V, n = 1, opts?: { min?: number }): V
```

## intersect

Compute the overlapping region of two rects — the clip operation (a view rect ∩ its ancestor's clip).

```ts
intersect(a: Rect, b: Rect): Rect
```

## Justify

Main-axis distribution of leftover space (like CSS `justify-content`).

```ts
type Justify = 'start' | 'center' | 'end' | 'space-between'
```

## layout

Lay out a box tree within a viewport.

```ts
layout(root: LayoutBox, viewport: Size2D): LayoutResult
```

## LayoutBox

A node in the layout input tree.

```ts
interface LayoutBox {
  props: LayoutProps;
  children: readonly LayoutBox[];
  measure?: (available: Size2D) => Size2D;   // Natural content size for an `auto` box given the available content space (e.g. a label measuring its text). Omitted ⇒ the natural size is derived from `children`; an `auto` leaf with no `measure` resolves to `{0,0}`.
}
```

## LayoutProps

Layout properties of a box; all optional, with defaults matching CSS flexbox: `direction:'row'`, `size:'auto'`, `justify:'start'`, `align:'stretch'`, `gap:0`, `padding:0`.

```ts
interface LayoutProps {
  direction?: Direction;   // Container main axis (default `'row'`).
  size?: Size;   // Size within the parent's main axis (default `{ kind:'auto' }`).
  justify?: Justify;   // Main-axis distribution of leftover space (default `'start'`).
  align?: Align;   // Cross-axis alignment (default `'stretch'`).
  gap?: number;   // Integer cells between adjacent children (default `0`).
  padding?: number | Padding;   // Content inset; a number applies to all sides (default `0`).
  position?: 'flow' | 'absolute' | 'fill';   // Placement mode (default `'flow'`). `'flow'` joins the parent's flex flow; `'absolute'` removes the box from flow and places it at rect within the parent's content box — overlapping siblings freely and reserving no flow space (the CSS `position:absolute` analogy); `'fill'` is a self-sizing overlay that takes the parent's **whole content box**, overlaps siblings, reserves no flow space, and is excluded from the parent's intrinsic size — so it needs no `rect` and re-solves for free when the parent resizes. Several `'fill'` children stack in the same box.
  rect?: Readonly<Rect>;   // `position:'absolute'` only — the parent-content-relative rect in cells (each side clamped to a non-negative integer). Ignored for `'flow'` and `'fill'` (a `'fill'` box always takes the full content box); absent on an absolute box ⇒ a degenerate zero rect (no throw). Read-only through the view's `layout`, so a solved rect cannot be edited a field at a time behind `setLayout`'s back — that would move the view without ever requesting a reflow.
}
```

## LayoutResult

The computed rect for every box, keyed by box identity (parent-relative).

```ts
type LayoutResult = Map<LayoutBox, Rect>
```

## Padding

Per-side content inset, in integer cells.

```ts
interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
```

## place

Tag a view with a Placement for use as a stack layer, and return the same view for inline composition.

```ts
place<V extends View>(view: V, placement: Placement): V
```

## Placement

Where a stack layer sits within the shared overlay box.

```ts
interface Placement {
  h?: PlaceAxis;   // Horizontal mode (default `'fill'`).
  v?: PlaceAxis;   // Vertical mode (default `'fill'`).
  width?: number;   // Fixed width in cells for a non-`fill` horizontal axis.
  height?: number;   // Fixed height in cells for a non-`fill` vertical axis.
  hOffset?: number;   // Horizontal inset in cells, applied after the `start`/`center`/`end` position: a positive value moves the layer *away from its anchored edge* (right for `start`/`center`, left for `end`), then the box is clamped to stay within the content box. Ignored on a `'fill'` horizontal axis.
  vOffset?: number;   // Vertical inset in cells, applied after the `start`/`center`/`end` position: a positive value moves the layer *away from its anchored edge* (down for `start`/`center`, up for `end`), then the box is clamped to stay within the content box. Ignored on a `'fill'` vertical axis.
}
```

## Point

A point in integer terminal cells (column `x`, row `y`).

```ts
interface Point {
  x: number;
  y: number;
}
```

## PopupHost

The overlay + focus host an anchored popup needs to mount and focus itself.

```ts
interface PopupHost {
  overlay: Group;   // The full-viewport, top-most overlay `Group` to mount the popup (and its outside-click catcher) into.
  focusView(view: View): void;   // Focus a view — the popup focuses its list on open; a non-focusable target is a no-op.
  getFocused(): View | null;   // The currently-focused view (saved before the popup opens, restored on dismiss), or `null`.
}
```

## Rect

A parent-relative rectangle in integer cells.

```ts
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

## RenderRoot

Mounts a view tree and renders it to a screen buffer.

```ts
interface RenderRoot {
  mount(root: View): void;   // Mount a view tree: wire its scopes, run the first layout, and compose the first frame.
  unmount(): void;   // Unmount the mounted tree: dispose its reactive scope — which recursively disposes every descendant scope and runs their `onCleanup` — then drop the tree. Idempotent, and safe to call with nothing mounted. A host that detaches a still-live tree (the browser `mountApp` teardown) calls this so views release timers and subscriptions instead of leaking across a re-mount.
  resize(size: Size2D): void;   // Resize the viewport, triggering a full re-layout and recompose.
  flush(): void;   // Force a synchronous frame now, running any pending scheduled repaint immediately.
  serialize(): string;   // The last frame's damage-diff output (the escape sequences to apply); forces a flush if one is pending.
  buffer(): ScreenBuffer;   // The live composed screen buffer — for host integration and tests.
  originOf(view: View): Point | null;   // The view's **absolute** top-left cell as of the last time it was composed, or `null` if it was never composed (unmounted / not visible). The event loop uses this to translate a focused view's `desiredCaret()` into an absolute terminal cell. An origin survives partial repaints — a view unchanged this frame keeps its last origin — so the caret is never lost just because the focused view was outside the changed region.
  setRevealAccelerators(on: boolean, scope?: View | null): void;   // Reveal (or hide) the hotkey-accelerator overlay for the next frame. While `on`, every widget that draws a `~X~` hotkey underlines its hot glyph. `scope` limits the reveal to a subtree (e.g. the active modal dialog); `null`/omitted reveals the whole tree. A change forces one coalesced full recompose on the next frame so the underlines appear/disappear together. Underlining does not change any cell width, so geometry never shifts.
  setTheme(theme: Theme): void;   // Replace the active theme and force one coalesced full recompose, so every view repaints with the new colors on the next frame. A theme swap changes no geometry, so origins are preserved and the caret is not lost. Under the event loop's no-op schedule this only marks the frame dirty — call it through `EventLoop.setTheme` (or `flush()` directly) to actually push the frame.
}
```

## RenderRootOptions

Options for createRenderRoot .

```ts
interface RenderRootOptions {
  caps: CapabilityProfile;   // REQUIRED — the terminal capability profile used to encode each frame's output.
  theme?: Theme;   // Active theme; defaults to the built-in default theme.
  schedule?: (flush: () => void) => void;   // How a pending repaint is scheduled; defaults to `queueMicrotask` (one coalesced frame per tick). A custom scheduler **must defer** the callback rather than invoking it inline. Coalescing is what makes invalidation cheap: many invalidations in one tick collapse into a single frame. A synchronous `(flush) => flush()` defeats that — every invalidation becomes its own frame: a full repaint pass for `invalidate`, and a reflow plus recompose for `invalidateLayout`. Building a tree then costs one frame per view. Tests that need a frame inline should call the render root's `flush()` instead.
  logger?: Logger;   // Where a widget's `draw()` errors are logged; defaults to a disabled logger (silent).
  healFocus?: (group: View) => void;   // Hook to re-home focus after a group removes its currently-focused child. The event loop wires this so focus lands on a sensible sibling; a standalone (non-interactive) render root leaves it unset.
}
```

## row

Build a **horizontal** flex container (`direction: 'row'`) — children sit left to right.

```ts
row(...args: [Flex, ...Child[]] | Child[]): Group
```

## Size

How a box is sized along its parent's main axis.

```ts
type Size = | { kind: 'fixed'; cells: number } // exact integer cells
  | {
      kind: 'fr';
      weight: number; // grow-weight share of leftover space
      /**
       * Optional floor in whole cells: an `fr` box never sizes below this, and it reserves the
       * floor even inside a shrink-to-fit (`auto`) parent. Omitted ⇒ no floor — identical to the
       * pre-existing behaviour. A negative value clamps to 0 in {@link normalizeSize}.
       */
      min?: number;
    }
  | { kind: 'auto' }
```

## Size2D

Cell dimensions (width × height) in integer terminal cells.

```ts
interface Size2D {
  width: number;
  height: number;
}
```

## solveTrack

Solve a 1-D flex track into exact integer sizes.

```ts
solveTrack(total: number, items: readonly TrackItem[], gap = 0): number[]
```

## spacer

Insert an empty spacer between children.

```ts
spacer(arg: number | { fixed: number } = 1): View
```

## stack

Build a z-overlay stack: every layer shares the same box and paints back-to-front (a later layer draws over an earlier one).

```ts
stack(...args: [Flex, ...Layer[]] | Layer[]): Group
```

## ThemeRoleName

A theme-role name — any key of the active `Theme`, e.g.

```ts
type ThemeRoleName = keyof Theme
```

## topLeft

Tag a view as a fixed-size stack layer pinned to the **top-left** corner.

```ts
topLeft<V extends View>(view: V, width: number, height: number): V
```

## topRight

Tag a view as a fixed-size stack layer pinned to the **top-right** corner.

```ts
topRight<V extends View>(view: V, width: number, height: number): V
```

## TrackItem

A single item along a 1-D flex track: either a fixed cell count or a flexible grow-weight share.

```ts
type TrackItem = | { readonly kind: 'fixed'; readonly size: number } // exact integer cells
  | {
      readonly kind: 'flex';
      readonly weight: number; // `fr` / grow weight
      /**
       * Optional floor in whole cells: this item is never solved below `min`, even as the
       * container shrinks. When **no** item on the track carries a `min`, the solver runs its
       * plain apportionment untouched (the no-min fast path), so the field is free for every
       * existing caller. When the floors are collectively unsatisfiable — their sum exceeds the
       * available space — every item squeezes proportionally rather than overflow the track.
       */
      readonly min?: number;
    }
```

## translate

Offset a rect by `(dx, dy)`, keeping its size — e.g. to convert view-local coordinates to absolute screen coordinates.

```ts
translate(r: Rect, dx: number, dy: number): Rect
```

## View

Abstract widget base.

```ts
new View()
// methods & signals:
bounds: Rect
state: ViewState
layout: Readonly<LayoutProps>
castsShadow
centered
grabsFocus
focusSignal(): Signal<void>
selectByClick(): void
setLayout(patch: Partial<LayoutProps>): void
```

## ViewState

A view's state flags.

```ts
interface ViewState {
  visible: boolean;
  disabled: boolean;
  focused: boolean;
}
```
