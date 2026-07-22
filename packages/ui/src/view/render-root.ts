/**
 * The render root — what turns a view tree into terminal output.
 *
 * A `RenderRoot` owns the screen buffer, the viewport size, the theme, the terminal capabilities,
 * the draw-error logger, and the frame scheduler. It mounts a view tree, runs layout, composes the
 * tree into the buffer, and produces a damage diff (the minimal escape-sequence output) between the
 * new frame and the previous one.
 *
 * Composing walks the tree: it draws each view through a clipped `DrawContext`, recurses into a
 * group's children back-to-front, and isolates a throwing `draw()` — logging it and skipping that
 * subtree, so one crashing widget never blanks the whole screen. It repaints only what changed where
 * it safely can, and falls back to a full z-ordered recompose when overlapping views make a partial
 * repaint unsafe.
 */
import { ScreenBuffer, serialize, defaultTheme, createLogger, Attr } from '@jsvision/core';
import type { Theme, CapabilityProfile, Logger } from '@jsvision/core';
import { createRoot, getOwner } from '../reactive/index.js';
import type { Rect, Size2D } from '../layout/index.js';
import { View } from './view.js';
import type { ViewHost } from './view.js';
import { Group } from './group.js';
import type { Point } from './geometry.js';
import { intersect } from './geometry.js';
import { themeRoleToStyle } from './theme-style.js';
import { makeDrawContext } from './draw-context.js';
import { reflow } from './reflow.js';
import type { RenderRootOptions } from './types.js';

/** Blank fill for a fresh buffer (terminal default colors, space glyph). */
const BLANK = { fg: 'default', bg: 'default' } as const;

/**
 * Mounts a view tree and renders it to a screen buffer. This is the seam a host (or the higher-level
 * app shell / event loop) wires the terminal to.
 */
export interface RenderRoot {
  /** Mount a view tree: wire its scopes, run the first layout, and compose the first frame. */
  mount(root: View): void;
  /**
   * Unmount the mounted tree: dispose its reactive scope — which recursively disposes every
   * descendant scope and runs their `onCleanup` — then drop the tree. Idempotent, and safe to call
   * with nothing mounted. A host that detaches a still-live tree (the browser `mountApp` teardown)
   * calls this so views release timers and subscriptions instead of leaking across a re-mount.
   */
  unmount(): void;
  /** Resize the viewport, triggering a full re-layout and recompose. */
  resize(size: Size2D): void;
  /** Force a synchronous frame now, running any pending scheduled repaint immediately. */
  flush(): void;
  /** The last frame's damage-diff output (the escape sequences to apply); forces a flush if one is pending. */
  serialize(): string;
  /** The live composed screen buffer — for host integration and tests. */
  buffer(): ScreenBuffer;
  /**
   * The view's **absolute** top-left cell as of the last time it was composed, or `null` if it was
   * never composed (unmounted / not visible). The event loop uses this to translate a focused view's
   * `desiredCaret()` into an absolute terminal cell. An origin survives partial repaints — a view
   * unchanged this frame keeps its last origin — so the caret is never lost just because the focused
   * view was outside the changed region.
   *
   * @param view The view to locate (typically the focused leaf).
   * @returns The absolute origin `{ x, y }`, or `null` if never composed.
   */
  originOf(view: View): Point | null;
  /**
   * Reveal (or hide) the hotkey-accelerator overlay for the next frame. While `on`, every widget that
   * draws a `~X~` hotkey underlines its hot glyph. `scope` limits the reveal to a subtree (e.g. the
   * active modal dialog); `null`/omitted reveals the whole tree. A change forces one coalesced full
   * recompose on the next frame so the underlines appear/disappear together. Underlining does not
   * change any cell width, so geometry never shifts.
   *
   * @param on    Whether the overlay is revealed.
   * @param scope The subtree to limit the reveal to, or `null` for the whole tree.
   */
  setRevealAccelerators(on: boolean, scope?: View | null): void;
  /**
   * Replace the active theme and force one coalesced full recompose, so every view repaints with the
   * new colors on the next frame. A theme swap changes no geometry, so origins are preserved and the
   * caret is not lost. Under the event loop's no-op schedule this only marks the frame dirty — call it
   * through `EventLoop.setTheme` (or `flush()` directly) to actually push the frame.
   *
   * @param theme The theme to switch to.
   * @example
   * import { Group, createRenderRoot } from '@jsvision/ui';
   * import { resolveCapabilities, nordTheme } from '@jsvision/core';
   *
   * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
   * const renderRoot = createRenderRoot({ width: 40, height: 10 }, { caps });
   * renderRoot.mount(new Group());
   *
   * renderRoot.setTheme(nordTheme);
   * renderRoot.flush(); // push the repainted frame
   */
  setTheme(theme: Theme): void;
}

/**
 * Per-view compose record cached on a full compose and reused by a partial repaint. `order` is the
 * depth-first paint index (back-to-front) — used to detect when a view is occluded by a later-painted
 * one, which decides whether a partial repaint is safe.
 */
type ComposeContext = { origin: Point; clip: Rect; order: number };

/**
 * The hotkey-overlay reveal state threaded through the compose walk. `on` is the root flag; `scope`
 * limits the reveal to a subtree — `null` reveals the whole tree. The walk tracks whether it is
 * inside `scope` yet, and the value handed to each `DrawContext` is `on && (scope === null || inside)`.
 */
type RevealState = { readonly on: boolean; readonly scope: View | null };

/**
 * Paint a drop shadow on the cells just below and to the right of `rect` (absolute), clipped to
 * `clip`. Only the cell colors change — the glyph and its width are preserved. Drawn in paint order,
 * so a front window's shadow lands correctly over the windows behind it.
 *
 * @param buffer The shared compose buffer.
 * @param rect   The shadow-caster's absolute rect.
 * @param clip   The parent's absolute clip (the shadow never escapes the caster's container).
 * @param theme  The active theme (for the `shadow` role colors).
 */
function drawDropShadow(buffer: ScreenBuffer, rect: Rect, clip: Rect, theme: Theme): void {
  const style = themeRoleToStyle(theme.shadow);
  const attrs = style.attrs ?? Attr.none;
  const clipRight = clip.x + clip.width;
  const clipBottom = clip.y + clip.height;
  const darken = (absX: number, absY: number): void => {
    if (absX < clip.x || absX >= clipRight || absY < clip.y || absY >= clipBottom) return;
    const cell = buffer.get(absX, absY);
    if (cell) {
      cell.fg = style.fg;
      cell.bg = style.bg;
      cell.attrs = attrs;
    }
  };
  // The drop shadow is an L shape: a 2-column band on the right (rows offset down by 1) plus a 1-row
  // band along the bottom (columns offset right by 1). It is deeper on the right than the bottom, as
  // if lit from the upper-left. Matches the DrawContext.shadow geometry.
  for (let row = 0; row < rect.height; row += 1) {
    darken(rect.x + rect.width, rect.y + row + 1);
    darken(rect.x + rect.width + 1, rect.y + row + 1);
  }
  for (let col = 0; col < rect.width; col += 1) darken(rect.x + col + 1, rect.y + rect.height);
}

/** How far a drop shadow extends past its caster: +2 columns right, +1 row bottom. */
const SHADOW_MARGIN = { width: 2, height: 1 } as const;

function composeView(
  buffer: ScreenBuffer,
  view: View,
  absOrigin: Point,
  clip: Rect,
  theme: Theme,
  caps: CapabilityProfile,
  reveal: RevealState,
  insideScope: boolean,
  logger: Logger,
  cache: Map<View, ComposeContext>,
  counter: { n: number } | null,
): void {
  if (!view.state.visible) return;
  // Assign a fresh paint index on a full compose (`counter` set); preserve the existing one on a
  // partial recompose (`counter` null) so the cross-frame occlusion test stays stable — z-order only
  // changes via reflow, which always does a full compose.
  const order = counter !== null ? counter.n++ : (cache.get(view)?.order ?? 0);
  cache.set(view, { origin: absOrigin, clip, order }); // where + when this view composed

  const viewRect: Rect = {
    x: absOrigin.x,
    y: absOrigin.y,
    width: view.bounds.width,
    height: view.bounds.height,
  };
  // Reveal is scope-limited: `insideScope` flips true once the walk reaches the scope root, so a
  // background view (outside the modal subtree) composes with reveal off and never underlines.
  const nowInside = insideScope || view === reveal.scope;
  const revealHere = reveal.on && (reveal.scope === null || nowInside);
  const ctx = makeDrawContext(buffer, viewRect, clip, theme, caps, revealHere);
  try {
    view.draw(ctx);
  } catch (error) {
    logger.error('view', 'draw() threw', { error: String(error) });
    return; // isolate the failure: skip this subtree so one bad widget can't blank the screen
  }

  if (view instanceof Group) {
    for (const child of view.children) {
      if (!child.state.visible) continue; // skipped entirely, like display:none
      const childOrigin: Point = { x: absOrigin.x + child.bounds.x, y: absOrigin.y + child.bounds.y };
      const childRect: Rect = {
        x: childOrigin.x,
        y: childOrigin.y,
        width: child.bounds.width,
        height: child.bounds.height,
      };
      // Cast the child's shadow (in z-order, under the parent's clip) before painting the child, so a
      // later (front) sibling's shadow falls over the earlier (back) siblings already composed.
      if (child.castsShadow) drawDropShadow(buffer, childRect, clip, theme);
      composeView(
        buffer,
        child,
        childOrigin,
        intersect(clip, childRect),
        theme,
        caps,
        reveal,
        nowInside,
        logger,
        cache,
        counter,
      );
    }
  }
}

/** Whether `ancestor` is `node` itself or an ancestor of it (walks the parent chain). */
function isAncestor(ancestor: View, node: View): boolean {
  let cursor: View | null = node;
  while (cursor !== null) {
    if (cursor === ancestor) return true;
    cursor = cursor.parent;
  }
  return false;
}

/**
 * The dirty views with no dirty ancestor — an ancestor's subtree recompose already covers its
 * dirty descendants, so they are dropped to avoid redundant work.
 */
function topmostDirty(dirty: Set<View>): View[] {
  const out: View[] = [];
  for (const view of dirty) {
    let ancestor = view.parent;
    let covered = false;
    while (ancestor !== null) {
      if (dirty.has(ancestor)) {
        covered = true;
        break;
      }
      ancestor = ancestor.parent;
    }
    if (!covered) out.push(view);
  }
  return out;
}

/** Concrete render root. Implements `ViewHost` so views can schedule repaint/reflow through it. */
class RenderRootImpl implements RenderRoot, ViewHost {
  private current: ScreenBuffer;
  private viewport: Size2D;
  private theme: Theme; // mutable so setTheme can hot-swap it (a swap forces one full recompose)
  private readonly caps: CapabilityProfile;
  private readonly logger: Logger;
  private readonly scheduler: (flush: () => void) => void;
  private readonly healFocusSeam?: (group: View) => void;

  private rootView: View | null = null;
  private disposeRoot: (() => void) | null = null;
  private needsReflow = false;
  private scheduled = false;
  private lastFrame = '';
  private readonly dirty = new Set<View>();
  private readonly cache = new Map<View, ComposeContext>();
  /** Accelerator-overlay reveal flag (mutable, unlike `caps`) — a change forces a full recompose. */
  private revealAccelerators = false;
  /** The dispatch-scope subtree reveal is clamped to (a modal), or `null` for the whole tree. */
  private revealScope: View | null = null;

  constructor(size: Size2D, opts: RenderRootOptions) {
    this.viewport = size;
    this.caps = opts.caps;
    this.theme = opts.theme ?? defaultTheme;
    this.logger = opts.logger ?? createLogger();
    this.scheduler = opts.schedule ?? ((flush): void => queueMicrotask(flush));
    this.healFocusSeam = opts.healFocus;
    this.current = new ScreenBuffer(size.width, size.height, BLANK);
  }

  /** @internal ViewHost — re-home focus after a group lost its focused child. */
  healFocus(group: View): void {
    this.healFocusSeam?.(group);
  }

  mount(root: View): void {
    this.disposeRoot?.(); // safe to re-mount: dispose any previously-mounted tree first
    this.rootView = root;
    createRoot((dispose) => {
      this.disposeRoot = dispose;
      root.mount(this, getOwner()); // view scopes nest under this root scope; `this` is the host
    });
    this.needsReflow = true;
    this.flush(); // first layout + full compose
  }

  unmount(): void {
    // Disposing the root scope cascades through every descendant view scope, firing their onCleanup.
    this.disposeRoot?.();
    this.disposeRoot = null;
    this.rootView = null;
  }

  resize(size: Size2D): void {
    this.viewport = size;
    this.current = new ScreenBuffer(size.width, size.height, BLANK);
    this.needsReflow = true;
    this.scheduleFlush();
  }

  /** @internal ViewHost — mark a view for repaint and schedule a coalesced frame. */
  markRepaint(view: View): void {
    // A repaint that coincides with a visibility change needs the layout path, not a partial repaint:
    // layout omits hidden views, and a full compose repaints the region that was revealed or vacated.
    // The compose cache tells us the last state — a view in it was visible last frame — so a change is
    // `visible XOR cached`. Escalate to a relayout so a bare `invalidate()` is correct either way.
    const wasVisible = this.cache.has(view);
    if (view.state.visible !== wasVisible) {
      this.markRelayout();
      return;
    }
    this.dirty.add(view);
    this.scheduleFlush();
  }

  /** @see RenderRoot.setRevealAccelerators */
  setRevealAccelerators(on: boolean, scope: View | null = null): void {
    if (this.revealAccelerators === on && this.revealScope === scope) return; // no change → no work
    this.revealAccelerators = on;
    this.revealScope = scope;
    this.markRelayout(); // one coalesced full recompose paints/clears every underline together
  }

  /** @see RenderRoot.setTheme */
  setTheme(theme: Theme): void {
    this.theme = theme;
    // A theme swap changes a compose input (colors) but no geometry, so a relayout is a harmless
    // deterministic no-op on positions; it drives the same single full recompose the accelerator
    // overlay already relies on.
    this.markRelayout();
  }

  /** @internal ViewHost — schedule a re-layout + recompose. */
  markRelayout(): void {
    this.needsReflow = true;
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.scheduled) return; // coalesce — at most one frame per tick
    this.scheduled = true;
    this.scheduler(() => this.flush());
  }

  flush(): void {
    this.scheduled = false;
    if (this.rootView === null) return;

    const previous = this.current.clone(); // exact snapshot of the last frame, for the damage diff

    // Snapshot and CLEAR the pending-work flags BEFORE doing the work. Layout fires `onMount`
    // callbacks — a common site for `bind()` — and an `onMount(() => group.add(child))` sets the
    // reflow/dirty flags mid-frame. Clearing first means that new work lands in the now-empty sets and
    // schedules the NEXT frame, instead of being wiped by a trailing reset and lost forever.
    const wasReflow = this.needsReflow;
    this.needsReflow = false;
    const dirtyViews = topmostDirty(this.dirty);
    this.dirty.clear();

    if (wasReflow) {
      // Layout changed, so every view's cached position may be stale → recompose the whole tree.
      reflow(this.rootView, this.viewport);
      this.fullCompose();
    } else {
      // Repaint only the changed subtrees from their cached positions — but a partial repaint draws a
      // subtree in isolation, which is only correct when nothing paints over it. If a changed view is
      // overlapped by a later-painted view outside its own subtree (overlapping windows), repainting
      // just that subtree would bleed it over the thing in front, so fall back to a full z-ordered
      // recompose for this frame. The fast path holds for non-overlapping UIs.
      if (this.anyOccluded(dirtyViews)) {
        this.fullCompose();
      } else {
        const reveal: RevealState = { on: this.revealAccelerators, scope: this.revealScope };
        for (const view of dirtyViews) {
          const ctx = this.cache.get(view);
          if (ctx !== undefined) {
            // A partial repaint starts mid-tree, so seed `insideScope` from whether this view is at or
            // below the reveal scope; the recursion flips it for any descendant that crosses the scope.
            const insideScope = reveal.scope !== null && isAncestor(reveal.scope, view);
            composeView(
              this.current,
              view,
              ctx.origin,
              ctx.clip,
              this.theme,
              this.caps,
              reveal,
              insideScope,
              this.logger,
              this.cache,
              null,
            );
          }
        }
      }
    }
    this.lastFrame = serialize(this.current, previous, { caps: this.caps });
  }

  /** Compose the whole tree from the root in z-order, refreshing the per-view context cache. */
  private fullCompose(): void {
    if (this.rootView === null) return;
    this.cache.clear();
    const origin: Point = { x: this.rootView.bounds.x, y: this.rootView.bounds.y };
    composeView(
      this.current,
      this.rootView,
      origin,
      { ...this.rootView.bounds },
      this.theme,
      this.caps,
      { on: this.revealAccelerators, scope: this.revealScope },
      false, // the root is outside any modal scope until the walk reaches `revealScope`
      this.logger,
      this.cache,
      { n: 0 },
    );
  }

  /**
   * Whether any dirty view is overlapped by a view painted after it (and outside its own subtree) —
   * an occluder a partial recompose would wrongly draw under. Uses the cached paint order + origins
   * from the last full compose; geometry and z-order are stable between reflows.
   */
  private anyOccluded(dirtyViews: View[]): boolean {
    for (const view of dirtyViews) {
      const cv = this.cache.get(view);
      if (cv === undefined) continue;
      const rv: Rect = { x: cv.origin.x, y: cv.origin.y, width: view.bounds.width, height: view.bounds.height };
      for (const [other, co] of this.cache) {
        if (other === view || co.order <= cv.order) continue; // same view, or painted before it
        if (isAncestor(view, other)) continue; // inside the dirty subtree — recomposing `view` covers it
        // A shadow-caster occludes not just its own rect but the cells its drop shadow overhangs
        // (+2 cols right, +1 row bottom). Expand the occluder's footprint by that margin so a back
        // view overlapped only by a front view's SHADOW still forces a full recompose, preserving the
        // shadow a partial repaint would otherwise wipe.
        const ro: Rect = {
          x: co.origin.x,
          y: co.origin.y,
          width: other.bounds.width + (other.castsShadow ? SHADOW_MARGIN.width : 0),
          height: other.bounds.height + (other.castsShadow ? SHADOW_MARGIN.height : 0),
        };
        const overlap = intersect(rv, ro);
        if (overlap.width > 0 && overlap.height > 0) return true;
      }
    }
    return false;
  }

  serialize(): string {
    if (this.scheduled) this.flush(); // force the pending frame
    return this.lastFrame;
  }

  buffer(): ScreenBuffer {
    return this.current;
  }

  /** @see RenderRoot.originOf */
  originOf(view: View): Point | null {
    const ctx = this.cache.get(view);
    return ctx === undefined ? null : { x: ctx.origin.x, y: ctx.origin.y };
  }
}

/**
 * Create a render root over a `size`-cell buffer, ready to mount and render a view tree.
 *
 * @param size The viewport size in cells.
 * @param opts Required `caps` (the terminal capability profile) plus optional `theme`, `schedule`,
 *   and `logger` — see {@link RenderRootOptions}.
 * @returns A {@link RenderRoot}; call `mount(root)` then read `serialize()`/`buffer()`.
 * @example
 * import { Group, View, createRenderRoot } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const root = new Group();
 * root.background = 'desktop';
 * // ...root.add(...) your widgets...
 *
 * const render = createRenderRoot({ width: 80, height: 24 }, { caps });
 * render.mount(root);       // lays out + composes the first frame
 * const bytes = render.serialize(); // the escape sequences to write to the terminal
 */
export function createRenderRoot(size: Size2D, opts: RenderRootOptions): RenderRoot {
  return new RenderRootImpl(size, opts);
}
