/**
 * {@link SplitView} — a resizable split-pane container: N panes divided by N−1 draggable 1-cell
 * splitters, along a `row` or `col` axis. Splits nest, so a row holding a col split is a grid.
 *
 * The design is declarative: panes are `fr` tracks whose weights a drag rewrites, and the existing
 * reflow places everything — so a pane's interior always reflows correctly against its rect. Pane
 * size is an INPUT to the reflow, never an output of the draw.
 */
import { Group, View } from '../view/index.js';
import type { DispatchEvent } from '../view/index.js';
import { signal, type Signal } from '../reactive/index.js';
import type { Direction } from '../layout/index.js';
import { Splitter } from './splitter.js';
import type { SplitOwner } from './splitter.js';
import { applySplitResize } from './resize.js';

/** Clamp a raw number to a non-negative integer cell count (non-finite → 0). */
function toIntCells(x: number): number {
  return Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0;
}

/** Pad (with weight 1) or truncate `weights` to exactly `n` entries. */
function fitToPaneCount(weights: readonly number[], n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(i < weights.length ? weights[i] : 1);
  return out;
}

/** Expand a scalar minimum to a per-pane array, or pad/truncate an array minimum, flooring each to ≥ 0. */
function normalizeMins(minSize: number | number[] | undefined, n: number): number[] {
  if (minSize === undefined) return new Array<number>(n).fill(0);
  if (typeof minSize === 'number') return new Array<number>(n).fill(toIntCells(minSize));
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(toIntCells(minSize[i] ?? 0));
  return out;
}

/** True when two number arrays are element-wise equal (used to dedupe an unchanged `sizes` write). */
function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** An in-progress splitter drag: recomputed from the gesture's start each event (never accumulated). */
interface Gesture {
  index: number;
  startMain: number;
  startCells: number[];
}

/** Construction options for {@link SplitView}. */
export interface SplitViewOptions {
  /** Split axis: `'row'` = side-by-side panes, `'col'` = stacked panes. */
  direction: Direction;
  /** The pane views, in order. N children produce N−1 splitters. */
  children: View[];
  /**
   * Two-way pane sizing as `fr` weights. Seed it with ratios (`signal([1, 1])` = equal,
   * `[2, 1]` = 2:1); a drag rewrites it with the resolved cell counts. Restoring saved weights into a
   * differently-sized container rescales them proportionally.
   */
  sizes: Signal<number[]>;
  /** Minimum pane size in cells — a scalar applies to every pane, an array is per-pane. */
  minSize?: number | number[];
  /**
   * Whether each splitter draws the `▓` grab mark at its midpoint. Defaults to `true`. This is only
   * the initial value — the live state lives in the public {@link SplitView.grabMark} signal, so you
   * can flip it at runtime.
   */
  grabMark?: boolean;
  /**
   * Fired on every **live** change: each drag move that actually changes the sizes, and each keyboard
   * step. Never fires when the sizes are unchanged — a drag held against a minimum is a silent no-op.
   * Use this to mirror the layout live; use {@link SplitViewOptions.onResizeEnd} to persist it.
   */
  onResize?: (sizes: number[]) => void;
  /**
   * Fired once per **commit**: the pointer-up that ends a drag, and each discrete keyboard step. One
   * drag gesture fires this exactly once however far the pointer travelled — so this, not
   * {@link SplitViewOptions.onResize}, is the hook to persist a layout from.
   */
  onResizeEnd?: (sizes: number[]) => void;
}

/**
 * A resizable split-pane container. It is a class (not a factory), matching every other widget in the
 * package. Give it a `direction`, the pane `children`, and a caller-owned `sizes` signal of `fr`
 * weights; drag a splitter or focus it (Tab) and use the arrows to resize.
 *
 * A drag never pushes a pane below its `minSize`, and neither does a container shrink — when the
 * container is too small to honour every minimum the panes squeeze proportionally rather than
 * overflow. **While the container is that small there is no space to trade, so a drag does nothing**
 * (the divider freezes) until it grows again.
 *
 * @example
 * import { SplitView, Group, signal } from '@jsvision/ui';
 *
 * const explorer = new Group();
 * const editor = new Group();
 * const sizes = signal([1, 3]);                     // 1:3 to start; the drag rewrites in cells
 * const split = new SplitView({
 *   direction: 'row',
 *   children: [explorer, editor],
 *   sizes,
 *   minSize: 12,                                    // neither pane below 12 cells
 *   onResizeEnd: (next) => localStorage.setItem('panes', JSON.stringify(next)), // persist once per gesture
 * });
 * split.layout = { position: 'fill' };
 *
 * split.grabMark.set(false); // hide the ▓ grab marks on every divider; .set(true) restores them
 */
export class SplitView extends Group implements SplitOwner {
  /** The divider views, in order (N−1 of them). Focus one to resize it from the keyboard. */
  readonly splitters: Splitter[] = [];

  /**
   * Whether the splitters draw their `▓` grab mark. Seeded from {@link SplitViewOptions.grabMark}
   * (default `true`); write it to show/hide the mark on every divider at runtime — the splitters
   * repaint on the next frame.
   */
  readonly grabMark: Signal<boolean>;

  private readonly direction: Direction;
  private readonly panes: View[];
  private readonly sizes: Signal<number[]>;
  private readonly mins: number[];
  private readonly onResizeCb?: (sizes: number[]) => void;
  private readonly onResizeEndCb?: (sizes: number[]) => void;
  private readonly track: Group;
  private gesture: Gesture | null = null;

  constructor(opts: SplitViewOptions) {
    super();
    this.direction = opts.direction;
    this.panes = opts.children;
    this.sizes = opts.sizes;
    this.onResizeCb = opts.onResize;
    this.onResizeEndCb = opts.onResizeEnd;
    this.mins = normalizeMins(opts.minSize, this.panes.length);
    // Seeded before the splitters are built — each Splitter reads this.owner.grabMark() and binds it.
    this.grabMark = signal(opts.grabMark ?? true);

    // The inner track carries the real layout. It exists so a caller assigning `split.layout` (a whole
    // object write) can never clobber the container's own direction — the TabView precedent.
    this.track = new Group();
    this.track.layout = { position: 'fill', direction: this.direction, gap: 0 };

    // Interleave panes and 1-cell splitters. `sizes` length normalization is deferred to applyWeights
    // (it re-runs on every write of the caller-owned signal), so here just seed valid pane weights.
    const initial = fitToPaneCount(this.sizes.peek(), this.panes.length);
    this.panes.forEach((pane, i) => {
      pane.layout = { size: { kind: 'fr', weight: Math.max(0, initial[i]), min: this.mins[i] } };
      this.track.add(pane);
      if (i < this.panes.length - 1) {
        const splitter = new Splitter(this, i, this.direction);
        splitter.layout = { size: { kind: 'fixed', cells: 1 } };
        this.splitters.push(splitter);
        this.track.add(splitter);
      }
    });
    this.add(this.track);

    // Re-solve the pane weights on every `sizes` write, from any writer (a drag, a keyboard step, or a
    // caller restoring a saved layout). `bind` throws outside onMount, so wire it here.
    this.onMount(() => {
      this.bind(
        () => this.sizes(),
        (w) => this.applyWeights(w),
        { relayout: true },
      );
    });
  }

  /**
   * Push `w` into the pane weights, padding/truncating to the pane count first. A wrong-length write
   * is self-corrected back into the signal — but ONLY on a real length mismatch: after the correction
   * the length matches, so the effect cannot re-fire. An unconditional write-back would be an infinite
   * loop, because signals compare by identity and a fresh array reference always notifies.
   */
  private applyWeights(w: number[]): void {
    const fixed = fitToPaneCount(w, this.panes.length);
    if (fixed.length !== w.length) this.sizes.set(fixed);
    this.panes.forEach((pane, i) => {
      pane.layout = { size: { kind: 'fr', weight: Math.max(0, fixed[i]), min: this.mins[i] } };
    });
  }

  /** The live resolved pane sizes along the split axis — never the (possibly stale) `sizes` signal. */
  private resolvedCells(): number[] {
    return this.panes.map((p) => (this.direction === 'row' ? p.bounds.width : p.bounds.height));
  }

  /** The main-axis component of a raw (1-based) mouse coordinate for this split's direction. */
  private mainCoordOf(x: number, y: number): number {
    return this.direction === 'row' ? x : y;
  }

  /**
   * The single write path: dedupe an unchanged array (so a clamped no-op is silent), write it, and
   * fire the live `onResize`. Returns whether the sizes actually changed.
   */
  private commit(next: number[]): boolean {
    if (arraysEqual(next, this.sizes.peek())) return false;
    this.sizes.set(next); // → the onMount bind re-solves the track from the new weights
    this.onResizeCb?.(next);
    return true;
  }

  /**
   * Begin a captured splitter drag. Called by a {@link Splitter} on mouse-down. Capture is requested on
   * the SplitView itself (not the splitter, which moves under the pointer), mirroring how the desktop
   * captures on itself while a window merely asks it to.
   *
   * @param index The divider index being dragged.
   * @param ev    The mouse-down envelope (carries the pointer-capture seam).
   */
  beginDrag(index: number, ev: DispatchEvent): void {
    const e = ev.event;
    this.gesture = {
      index,
      startMain: e.type === 'mouse' ? this.mainCoordOf(e.x, e.y) : 0,
      startCells: this.resolvedCells(),
    };
    this.splitters[index].dragging.set(true);
    ev.setCapture?.(this);
    ev.handled = true;
  }

  /**
   * Resize the divider at `index` by `delta` cells from the live geometry — the keyboard path. A
   * discrete step, so it fires both `onResize` (live) and `onResizeEnd` (commit) when it changes
   * anything, and neither when clamped.
   *
   * @param index The divider index.
   * @param delta The signed cell movement.
   */
  resizeBy(index: number, delta: number): void {
    const next = applySplitResize(this.resolvedCells(), index, delta, this.mins);
    if (this.commit(next)) this.onResizeEndCb?.(next);
  }

  /** Handle a captured drag event (routed here while this view holds the pointer). */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (this.gesture === null || inner.type !== 'mouse') return;
    // If capture was lost externally (a modal opened mid-drag), abandon the gesture cleanly.
    if (ev.hasCapture !== undefined && !ev.hasCapture(this)) {
      this.endDrag();
      return;
    }
    if (inner.kind === 'up') {
      this.endDrag({ commit: true });
      ev.releaseCapture?.();
      ev.handled = true;
      return;
    }
    if (inner.kind === 'move' || inner.kind === 'drag') {
      // Recompute from the gesture's start + total delta each event (never accumulate) — that is what
      // makes a drag past a clamp stay pinned until the pointer returns past the clamp point.
      const totalDelta = this.mainCoordOf(inner.x, inner.y) - this.gesture.startMain;
      this.commit(applySplitResize(this.gesture.startCells, this.gesture.index, totalDelta, this.mins));
      ev.handled = true;
    }
  }

  /**
   * End the current drag: clear it and drop the drag highlight. Fires `onResizeEnd` once (with the
   * final sizes) only when `commit` is set — so a gesture abandoned by the staleness guard reports no
   * phantom commit. Idempotent: the staleness guard and the pointer-up can both reach it.
   */
  private endDrag(opts?: { commit?: boolean }): void {
    if (this.gesture === null) return;
    const { index } = this.gesture;
    this.gesture = null;
    this.splitters[index].dragging.set(false);
    if (opts?.commit === true) this.onResizeEndCb?.(this.sizes.peek());
  }
}
