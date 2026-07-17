/**
 * {@link Splitter} — the 1-cell draggable divider between two {@link SplitView} panes.
 *
 * It is focusable (a tab stop), so the arrow keys resize the divider it sits on; it paints a single
 * line down (row split) or across (col split) with a static `▓` grab mark at its midpoint, in the
 * `splitter` theme role — or `splitterDragging` while a drag is in flight. It owns no resize math: a
 * mouse-down hands the gesture to its owner (which captures the pointer), and an arrow key asks the
 * owner to resize. Module-private — created and placed by `SplitView`, never constructed directly.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { Direction } from '../layout/index.js';

/** The slice of `SplitView` a {@link Splitter} drives — narrowed to avoid a runtime import cycle. */
export interface SplitOwner {
  /** Begin a captured drag of the divider at `index` (called on mouse-down). */
  beginDrag(index: number, ev: DispatchEvent): void;
  /** Resize the divider at `index` by `delta` cells from the live geometry (the keyboard path). */
  resizeBy(index: number, delta: number): void;
  /** Whether splitters draw the `▓` grab mark (read live in `draw` so a toggle repaints). */
  grabMark: Signal<boolean>;
}

/** The 1-cell divider view. Focusable so its owning split can be resized from the keyboard. */
export class Splitter extends View {
  /** A tab stop: focusing it scopes the resize arrows to this divider. */
  override focusable = true;

  /** True while this divider is being dragged; drives the `splitter`/`splitterDragging` role flip. */
  readonly dragging = signal(false);

  constructor(
    private readonly owner: SplitOwner,
    private readonly index: number,
    private readonly direction: Direction,
  ) {
    super();
    this.onMount(() => {
      // draw() is NOT auto-tracked, so a bare dragging.set() (or grabMark flip) schedules no frame.
      // Bind both reads here so a role flip or a grab-mark toggle actually repaints — without this the
      // divider stays painted `splitterDragging` after the drag ends (endDrag() does no resize, so
      // nothing else relayouts) and a `grabMark.set(...)` would leave the ▓ stale until the next frame.
      this.bind(() => {
        this.dragging();
        this.owner.grabMark();
      });
    });
  }

  /**
   * Paint the line fill in the current role, then — when `owner.grabMark()` is true — the static `▓`
   * grab mark at the midpoint.
   */
  override draw(ctx: DrawContext): void {
    const style = ctx.color(this.dragging() ? 'splitterDragging' : 'splitter');
    const row = this.direction === 'row';
    ctx.fill(row ? '│' : '─', style);
    if (this.owner.grabMark()) {
      if (row) ctx.text(0, Math.floor(ctx.size.height / 2), '▓', style);
      else ctx.text(Math.floor(ctx.size.width / 2), 0, '▓', style);
    }
  }

  /** Mouse-down starts a captured drag; an unmodified along-axis arrow resizes by 1 cell. */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse' && inner.kind === 'down') {
      this.owner.beginDrag(this.index, ev);
      return;
    }
    if (inner.type !== 'key') return;
    // Leave modified arrows (and cross-axis arrows) unhandled so they bubble to focus navigation —
    // the base grid-row handlers swallow modifiers, so a splitter must be careful not to do the same.
    if (inner.ctrl || inner.alt) return;
    const inc = this.direction === 'row' ? 'right' : 'down';
    const dec = this.direction === 'row' ? 'left' : 'up';
    if (inner.key === inc) {
      this.owner.resizeBy(this.index, 1);
      ev.handled = true;
    } else if (inner.key === dec) {
      this.owner.resizeBy(this.index, -1);
      ev.handled = true;
    }
  }
}
