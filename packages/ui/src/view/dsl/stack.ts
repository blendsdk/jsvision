/**
 * Overlay layout builders — the `stack` z-overlay container and its placement taggers
 * (`place`/`centered`/`topRight`/`bottomRight`/`topLeft`), a thin, expression-oriented sugar over
 * `Group`/`View` and their `layout` props.
 *
 * A `stack` shares one box across every layer and paints them back-to-front; the taggers pin a
 * fixed-size layer to an edge, corner, or the center. Because the builders only assemble ordinary
 * views and set ordinary `layout` props, the result reflows and resizes exactly like a hand-built
 * tree — there is no separate runtime.
 *
 * This lives in the view layer (not the layout engine) because it constructs `Group`/`View`
 * instances; the engine stays free of any view dependency.
 */
import { View } from '../view.js';
import { Group } from '../group.js';
import type { DrawContext } from '../types.js';
import type { Padding, Rect } from '../../layout/index.js';
import { toLayout, type Flex } from './flex.js';
import { devWarn } from '../../shared/warnings.js';

/**
 * A layer accepted by {@link stack}: a real {@link View}, or a falsy value
 * (`null`/`undefined`/`false`) that is skipped so `stack(canvas, cond && overlay)` composes without
 * a manual `.add()` dance.
 */
type Layer = View | null | undefined | false;

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
  /**
   * Horizontal inset in cells, applied after the `start`/`center`/`end` position: a positive value
   * moves the layer *away from its anchored edge* (right for `start`/`center`, left for `end`), then
   * the box is clamped to stay within the content box. Ignored on a `'fill'` horizontal axis.
   */
  hOffset?: number;
  /**
   * Vertical inset in cells, applied after the `start`/`center`/`end` position: a positive value
   * moves the layer *away from its anchored edge* (down for `start`/`center`, up for `end`), then the
   * box is clamped to stay within the content box. Ignored on a `'fill'` vertical axis.
   */
  vOffset?: number;
}

/** Placement tags attached by {@link place}; read by {@link stack} to wire each layer. */
const placements = new WeakMap<View, Placement>();

/** Views a {@link stack} has adopted — a WeakSet (like {@link placements}) so it never retains a view. */
const adoptedByStack = new WeakSet<View>();

/** Whether an axis mode fills (spans the whole extent) — the untagged/`'fill'` case. */
function isFillAxis(mode: PlaceAxis | undefined): boolean {
  return mode === undefined || mode === 'fill';
}

/**
 * Resolve a {@link Placement} to a content-box-relative {@link Rect} for a `W×H` content box: per
 * axis, `'fill'` (or no fixed size) spans `[0, extent]`, otherwise a size of `min(want, extent)` is
 * placed at the start (`0`), centered (`floor((extent-size)/2)`), or the end (`extent-size`). A
 * non-fill axis then applies its offset — a positive value insets the box away from its anchored edge
 * (added for `start`/`center`, subtracted for `end`) — and clamps to `[0, extent-size]` so the box
 * never leaves the content box. An offset on a `'fill'` axis is ignored (a fill spans everything).
 */
function layerRect(p: Placement, W: number, H: number): Rect {
  const axis = (
    mode: PlaceAxis | undefined,
    want: number | undefined,
    extent: number,
    offset: number,
  ): { pos: number; size: number } => {
    if (isFillAxis(mode) || want === undefined) return { pos: 0, size: extent };
    const size = Math.min(want, extent);
    const base = mode === 'start' ? 0 : mode === 'center' ? Math.floor((extent - size) / 2) : extent - size;
    const shifted = mode === 'end' ? base - offset : base + offset;
    const pos = Math.max(0, Math.min(extent - size, shifted));
    return { pos, size };
  };
  const h = axis(p.h, p.width, W, p.hOffset ?? 0);
  const v = axis(p.v, p.height, H, p.vOffset ?? 0);
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
 * takes a flex share of `1` by default, so a bare `stack(...)` fills its parent. A falsy layer
 * (`null`/`undefined`/`false`) is skipped, so `stack(canvas, showBadge && topRight(badge, 5, 1))`
 * composes without a manual `.add()` dance.
 *
 * Note: a `centered` layer centers against the stack's **full** box, not its content box — keep a
 * stack's `padding` at `0` for a true center.
 *
 * @param args An optional {@link Flex} props object followed by the layer views (back-to-front); a
 *   falsy layer is skipped.
 * @returns A `Group` overlay containing the wired (truthy) layers.
 * @example
 * import { stack, centered, topRight } from '@jsvision/ui';
 *
 * // A full-box canvas with a centered dialog and a badge pinned to the top-right corner.
 * const screen = stack({ background: 'desktop' }, canvas, centered(dialog, 40, 12), topRight(badge, 5, 1));
 */
export function stack(...args: [Flex, ...Layer[]] | Layer[]): Group {
  const overlay = new Stack();
  const first = args[0];
  let layers: Layer[];
  // A props object is a *truthy non-View* first argument; a View or a falsy value (a skipped layer)
  // is not — so a leading `cond && layer` is never mistaken for props.
  if (first !== null && first !== undefined && first !== false && !(first instanceof View)) {
    const props = first as Flex;
    layers = args.slice(1) as Layer[];
    const layout = toLayout(props, 'col');
    if (layout.size === undefined) layout.size = { kind: 'fr', weight: 1 }; // default: fill the parent
    overlay.layout = layout;
    if (props.background !== undefined) overlay.background = props.background;
  } else {
    layers = args as Layer[];
    overlay.layout = { size: { kind: 'fr', weight: 1 } };
  }

  for (const layer of layers) {
    // Skip null/undefined/false so a conditional layer composes; anything else is a real View.
    if (layer === null || layer === undefined || layer === false) continue;
    // Record adoption before the place() one-shot check runs (next microtask), so a properly-wired
    // layer never triggers the orphaned-tagger warning.
    adoptedByStack.add(layer);
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
  // A placement tag only does anything once a stack() adopts the view. If none has by the next
  // microtask (after synchronous composition), the tag is a silent no-op — warn the developer.
  // No throw, no production cost (devWarn is silent under NODE_ENV=production); a one-shot check.
  queueMicrotask(() => {
    if (placements.has(view) && !adoptedByStack.has(view)) {
      devWarn(
        'layout',
        'place()/centered()/topRight()/… on a view never added to a stack() has no effect — ' +
          'use cover()/center()/at() to place a standalone view.',
      );
    }
  });
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
