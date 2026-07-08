/**
 * Declarative layout builders — a thin, expression-oriented sugar over `Group`/`View` and their
 * `layout` props, so a whole screen can be composed in one nested expression instead of a sequence
 * of `new`, `.add()`, and `.layout = …` mutations.
 *
 * `col`/`row` build flex containers; `grow`/`fixed` set a child's size; `spacer` inserts flexible or
 * fixed gaps. Because the builders only assemble ordinary views and set ordinary `layout` props, the
 * result reflows and resizes exactly like a hand-built tree — there is no separate runtime.
 *
 * This lives in the view layer (not the layout engine) because it constructs `Group`/`View`
 * instances; the engine stays free of any view dependency.
 */
import { View } from './view.js';
import { Group } from './group.js';
import type { DrawContext, ThemeRoleName } from './types.js';
import type { Direction, LayoutProps, Padding, Rect, Size } from '../layout/index.js';

/**
 * Container props for {@link col}/{@link row}: every {@link LayoutProps} field except `direction`
 * (the builder sets that), plus size shorthands and a `background` role.
 *
 * `grow`/`fixed`/`fill` are shorthands for the `size` token — `grow: n` → `{ kind:'fr', weight:n }`,
 * `fixed: n` → `{ kind:'fixed', cells:n }`, `fill: true` → `{ kind:'fr', weight:1 }`. An explicit
 * `size` always wins over the shorthands. `background` sets the group's fill role (it is not a layout
 * prop). All fields are optional.
 *
 * @example
 * import { col, row } from '@jsvision/ui';
 *
 * // A fixed-width sidebar next to a growing main area, with 1 cell of gap and a filled background.
 * const layout: import('@jsvision/ui').Flex = { gap: 1, background: 'desktop' };
 * const screen = row(layout, col({ fixed: 20 }, sidebar), col({ grow: 1 }, main));
 */
export type Flex = Omit<LayoutProps, 'direction'> & {
  /** Flex-grow weight — shorthand for `size: { kind:'fr', weight }`. */
  grow?: number;
  /** Fixed cell count — shorthand for `size: { kind:'fixed', cells }`. */
  fixed?: number;
  /** Take a flex share of `1` — shorthand for `size: { kind:'fr', weight:1 }`. */
  fill?: boolean;
  /** Theme role filled behind the children before they paint. */
  background?: ThemeRoleName;
};

/**
 * Resolve a {@link Flex} into concrete {@link LayoutProps}: pick the one `size` token (explicit
 * `size` wins, else `fixed` → `grow` → `fill` → none), drop `background` (a Group property, not a
 * layout prop), and merge the container `direction`.
 */
function toLayout(f: Flex, direction: Direction): LayoutProps {
  const { grow: growN, fixed: fixedN, fill: fillOn, background: _bg, ...rest } = f;
  const size: Size | undefined =
    rest.size ??
    (fixedN !== undefined
      ? { kind: 'fixed', cells: fixedN }
      : growN !== undefined
        ? { kind: 'fr', weight: growN }
        : fillOn === true
          ? { kind: 'fr', weight: 1 }
          : undefined);
  const props: LayoutProps = { ...rest, direction };
  if (size !== undefined) props.size = size;
  return props;
}

/**
 * Build a flex container in the given direction. The first argument may be a {@link Flex} props
 * object or the first child; every remaining argument is a child view, added in order (paint order,
 * back-to-front).
 */
function container(direction: Direction, args: Array<Flex | View>): Group {
  const group = new Group();
  const first = args[0];
  let children: View[];
  if (first instanceof View) {
    // No props object — every argument is a child.
    children = args as View[];
    group.layout = { direction };
  } else {
    const props = (first as Flex | undefined) ?? {};
    children = args.slice(1) as View[];
    group.layout = toLayout(props, direction);
    if (props.background !== undefined) group.background = props.background;
  }
  for (const child of children) group.add(child);
  return group;
}

/**
 * Build a **vertical** flex container (`direction: 'col'`) — children stack top to bottom. Pass an
 * optional {@link Flex} props object first, then the child views.
 *
 * @param args An optional {@link Flex} props object followed by child views (or just child views).
 * @returns A `Group` with `layout.direction = 'col'` and the children added in order.
 * @example
 * import { col, fixed, grow } from '@jsvision/ui';
 *
 * // A header of fixed height above a growing body.
 * const page = col({ gap: 1 }, fixed(header, 3), grow(body));
 */
export function col(...args: [Flex, ...View[]] | View[]): Group {
  return container('col', args);
}

/**
 * Build a **horizontal** flex container (`direction: 'row'`) — children sit left to right. Pass an
 * optional {@link Flex} props object first, then the child views.
 *
 * @param args An optional {@link Flex} props object followed by child views (or just child views).
 * @returns A `Group` with `layout.direction = 'row'` and the children added in order.
 * @example
 * import { row, fixed, grow } from '@jsvision/ui';
 *
 * // A fixed-width sidebar beside a growing main pane.
 * const body = row(fixed(sidebar, 20), grow(main));
 */
export function row(...args: [Flex, ...View[]] | View[]): Group {
  return container('row', args);
}

/**
 * Give a view a flex-grow size: it takes a share of the container's leftover main-axis space
 * proportional to `n`. Mutates the view's `layout.size` (preserving its other layout props) and
 * returns the same view, so it composes inline inside a `col`/`row`.
 *
 * @param view The view to size.
 * @param n The flex weight (default `1`). Two `grow(v, 1)` children split the space evenly; a
 *   `grow(v, 2)` child gets twice the share of a `grow(v, 1)` sibling.
 * @returns The same `view`, for inline chaining.
 * @example
 * import { row, grow } from '@jsvision/ui';
 *
 * // `main` takes twice the width of `aside`.
 * const body = row(grow(aside, 1), grow(main, 2));
 */
export function grow<V extends View>(view: V, n = 1): V {
  view.layout = { ...view.layout, size: { kind: 'fr', weight: n } };
  return view;
}

/**
 * Give a view a fixed size of `n` cells along its container's main axis (columns in a `row`, rows in
 * a `col`). Mutates the view's `layout.size` (preserving its other layout props) and returns the same
 * view, so it composes inline inside a `col`/`row`.
 *
 * @param view The view to size.
 * @param n The fixed extent in whole cells.
 * @returns The same `view`, for inline chaining.
 * @example
 * import { col, fixed, grow } from '@jsvision/ui';
 *
 * // A 3-row status bar pinned below a growing body.
 * const app = col(grow(body), fixed(statusBar, 3));
 */
export function fixed<V extends View>(view: V, n: number): V {
  view.layout = { ...view.layout, size: { kind: 'fixed', cells: n } };
  return view;
}

/** An invisible view used only to reserve space in a `col`/`row`. */
class Empty extends View {
  draw(): void {
    // nothing to paint — a spacer only occupies layout space
  }
}

/**
 * Insert an empty spacer between children. With a numeric `weight` (default `1`) it is flexible —
 * it absorbs leftover space, pushing later children toward the far edge; with `{ fixed: n }` it is a
 * hard, exact `n`-cell gap.
 *
 * @param arg A flex weight (default `1`), or `{ fixed: n }` for an exact `n`-cell gap.
 * @returns A fresh invisible view with the requested size, ready to drop into a `col`/`row`.
 * @example
 * import { row, spacer } from '@jsvision/ui';
 *
 * // Push `help` to the right edge; keep a hard 2-cell gap before `cancel`.
 * const bar = row(ok, spacer({ fixed: 2 }), cancel, spacer(), help);
 */
export function spacer(arg: number | { fixed: number } = 1): View {
  const view = new Empty();
  view.layout =
    typeof arg === 'number' ? { size: { kind: 'fr', weight: arg } } : { size: { kind: 'fixed', cells: arg.fixed } };
  return view;
}

// --- Overlays: stack + placement ----------------------------------------------------------------

/** An alignment mode for one axis of a {@link Placement}. */
type PlaceAxis = 'fill' | 'start' | 'center' | 'end';

/**
 * Where a {@link stack} layer sits within the shared overlay box.
 *
 * Each axis is either `'fill'` (span the whole extent) or `'start'`/`'center'`/`'end'` (align a fixed
 * size given by `width`/`height`). An omitted axis defaults to `'fill'`. Build one with {@link place}
 * or the {@link centered}/{@link topRight}/{@link bottomRight}/{@link topLeft} conveniences.
 */
export interface Placement {
  /** Horizontal mode (default `'fill'`). */
  h?: PlaceAxis;
  /** Vertical mode (default `'fill'`). */
  v?: PlaceAxis;
  /** Fixed width in cells for a non-`fill` horizontal axis. */
  width?: number;
  /** Fixed height in cells for a non-`fill` vertical axis. */
  height?: number;
}

/** Placement tags attached by {@link place}; read by {@link stack} to wire each layer. */
const placements = new WeakMap<View, Placement>();

/** Whether an axis mode fills (spans the whole extent) — the untagged/`'fill'` case. */
function isFillAxis(mode: PlaceAxis | undefined): boolean {
  return mode === undefined || mode === 'fill';
}

/**
 * Resolve a {@link Placement} to a content-box-relative {@link Rect} for a `W×H` content box: per
 * axis, `'fill'` (or no fixed size) spans `[0, extent]`, otherwise a size of `min(want, extent)` is
 * placed at the start (`0`), centered (`floor((extent-size)/2)`), or the end (`extent-size`).
 */
function layerRect(p: Placement, W: number, H: number): Rect {
  const axis = (
    mode: PlaceAxis | undefined,
    want: number | undefined,
    extent: number,
  ): { pos: number; size: number } => {
    if (isFillAxis(mode) || want === undefined) return { pos: 0, size: extent };
    const size = Math.min(want, extent);
    const pos = mode === 'start' ? 0 : mode === 'center' ? Math.floor((extent - size) / 2) : extent - size;
    return { pos, size };
  };
  const h = axis(p.h, p.width, W);
  const v = axis(p.v, p.height, H);
  return { x: h.pos, y: v.pos, width: h.size, height: v.size };
}

/** Resolve a `LayoutProps.padding` shorthand to a per-side {@link Padding} (all sides default 0). */
function resolvePadding(padding: number | Padding | undefined): Padding {
  if (padding === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof padding === 'number') return { top: padding, right: padding, bottom: padding, left: padding };
  return padding;
}

/**
 * A z-overlay container. Fill and centered layers are positioned entirely by the layout engine (so
 * they re-solve lag-free on resize); corner/edge layers are absolutely placed and self-correct from
 * the stack's live size on each draw. The self-correct is change-gated — it only requests a reflow
 * when a recomputed rect actually differs — so it settles in one extra frame and never loops.
 */
class Stack extends Group {
  /** Corner/edge layers to reposition from the stack's live bounds, each with its placement. */
  private readonly tracked: Array<{ view: View; placement: Placement }> = [];

  /** Register a corner/edge layer for draw-time repositioning. */
  track(view: View, placement: Placement): void {
    this.tracked.push({ view, placement });
  }

  override draw(ctx: DrawContext): void {
    super.draw(ctx); // paint the background (if any)
    if (this.tracked.length === 0) return;

    const pad = resolvePadding(this.layout.padding);
    const cw = Math.max(0, this.bounds.width - pad.left - pad.right);
    const ch = Math.max(0, this.bounds.height - pad.top - pad.bottom);

    let changed = false;
    for (const { view, placement } of this.tracked) {
      const rect = layerRect(placement, cw, ch);
      const cur = view.layout.rect;
      // Only re-tag + reflow on an actual change: the rect is a deterministic function of the stack's
      // bounds, so once bounds are stable the recompute matches and the settle loop terminates.
      if (
        cur === undefined ||
        cur.x !== rect.x ||
        cur.y !== rect.y ||
        cur.width !== rect.width ||
        cur.height !== rect.height
      ) {
        view.layout = { ...view.layout, rect };
        changed = true;
      }
    }
    if (changed) this.invalidateLayout();
  }
}

/**
 * Build a z-overlay stack: every layer shares the same box and paints back-to-front (a later layer
 * draws over an earlier one). An untagged layer (or one placed to `'fill'` on both axes) fills the
 * whole box; a {@link centered} fixed box re-centers itself; a corner/edge layer (via
 * {@link topRight} etc.) pins to its edge. Fill and centered layers re-solve lag-free on resize;
 * corner/edge layers settle one frame later.
 *
 * Pass an optional {@link Flex} props object first (e.g. a `background`), then the layers. The stack
 * takes a flex share of `1` by default, so a bare `stack(...)` fills its parent.
 *
 * Note: a `centered` layer centers against the stack's **full** box, not its content box — keep a
 * stack's `padding` at `0` for a true center.
 *
 * @param args An optional {@link Flex} props object followed by the layer views (back-to-front).
 * @returns A `Group` overlay containing the wired layers.
 * @example
 * import { stack, centered, topRight } from '@jsvision/ui';
 *
 * // A full-box canvas with a centered dialog and a badge pinned to the top-right corner.
 * const screen = stack({ background: 'desktop' }, canvas, centered(dialog, 40, 12), topRight(badge, 5, 1));
 */
export function stack(...args: [Flex, ...View[]] | View[]): Group {
  const overlay = new Stack();
  const first = args[0];
  let layers: View[];
  if (first instanceof View) {
    layers = args as View[];
    overlay.layout = { size: { kind: 'fr', weight: 1 } };
  } else {
    const props = (first as Flex | undefined) ?? {};
    layers = args.slice(1) as View[];
    const layout = toLayout(props, 'col');
    if (layout.size === undefined) layout.size = { kind: 'fr', weight: 1 }; // default: fill the parent
    overlay.layout = layout;
    if (props.background !== undefined) overlay.background = props.background;
  }

  for (const layer of layers) {
    const placement = placements.get(layer);
    if (placement === undefined || (isFillAxis(placement.h) && isFillAxis(placement.v))) {
      // Untagged or both-axes fill → engine overlay fill (lag-free, layers overlap).
      layer.layout = { ...layer.layout, position: 'fill' };
    } else if (
      placement.h === 'center' &&
      placement.v === 'center' &&
      placement.width !== undefined &&
      placement.height !== undefined
    ) {
      // Centered fixed box → absolute + engine re-centering (lag-free).
      layer.layout = {
        ...layer.layout,
        position: 'absolute',
        rect: { x: 0, y: 0, width: placement.width, height: placement.height },
      };
      layer.centered = true;
    } else {
      // Corner/edge → absolute + draw-time self-correct (one-frame settle). The initial rect carries
      // the requested size at the origin; the first draw repositions it from the stack's real bounds.
      layer.layout = {
        ...layer.layout,
        position: 'absolute',
        rect: { x: 0, y: 0, width: placement.width ?? 0, height: placement.height ?? 0 },
      };
      overlay.track(layer, placement);
    }
    overlay.add(layer);
  }
  return overlay;
}

/**
 * Tag a view with a {@link Placement} for use as a {@link stack} layer, and return the same view for
 * inline composition. Without a tag, a stack layer fills the whole box; a tag pins it to an edge,
 * corner, or center.
 *
 * @param view The layer view to tag.
 * @param placement Where the layer should sit within the stack box.
 * @returns The same `view`, for inline chaining inside a `stack(...)`.
 * @example
 * import { stack, place } from '@jsvision/ui';
 *
 * // Pin a 20×3 panel to the bottom-left corner of the overlay.
 * const screen = stack(canvas, place(panel, { h: 'start', v: 'end', width: 20, height: 3 }));
 */
export function place<V extends View>(view: V, placement: Placement): V {
  placements.set(view, placement);
  return view;
}

/**
 * Tag a view as a centered fixed-size {@link stack} layer (`width × height`, centered on both axes).
 * It re-centers itself lag-free when the stack resizes.
 *
 * @param view The layer view.
 * @param width Fixed width in cells.
 * @param height Fixed height in cells.
 * @returns The same `view`, for inline chaining inside a `stack(...)`.
 * @example
 * import { stack, centered } from '@jsvision/ui';
 *
 * const screen = stack(canvas, centered(dialog, 40, 12));
 */
export function centered<V extends View>(view: V, width: number, height: number): V {
  return place(view, { h: 'center', v: 'center', width, height });
}

/**
 * Tag a view as a fixed-size {@link stack} layer pinned to the **top-right** corner.
 *
 * @param view The layer view.
 * @param width Fixed width in cells.
 * @param height Fixed height in cells.
 * @returns The same `view`, for inline chaining inside a `stack(...)`.
 * @example
 * import { stack, topRight } from '@jsvision/ui';
 *
 * const screen = stack(canvas, topRight(badge, 5, 1));
 */
export function topRight<V extends View>(view: V, width: number, height: number): V {
  return place(view, { h: 'end', v: 'start', width, height });
}

/**
 * Tag a view as a fixed-size {@link stack} layer pinned to the **bottom-right** corner.
 *
 * @param view The layer view.
 * @param width Fixed width in cells.
 * @param height Fixed height in cells.
 * @returns The same `view`, for inline chaining inside a `stack(...)`.
 * @example
 * import { stack, bottomRight } from '@jsvision/ui';
 *
 * const screen = stack(canvas, bottomRight(clock, 8, 1));
 */
export function bottomRight<V extends View>(view: V, width: number, height: number): V {
  return place(view, { h: 'end', v: 'end', width, height });
}

/**
 * Tag a view as a fixed-size {@link stack} layer pinned to the **top-left** corner.
 *
 * @param view The layer view.
 * @param width Fixed width in cells.
 * @param height Fixed height in cells.
 * @returns The same `view`, for inline chaining inside a `stack(...)`.
 * @example
 * import { stack, topLeft } from '@jsvision/ui';
 *
 * const screen = stack(canvas, topLeft(logo, 12, 2));
 */
export function topLeft<V extends View>(view: V, width: number, height: number): V {
  return place(view, { h: 'start', v: 'start', width, height });
}
