/**
 * Paint-only preview used by deferred Window resize gestures.
 *
 * The view permanently covers the Desktop but stays input-inert and draws nothing while idle. Its
 * own bounds never change, so pointer motion requests only a repaint of this topmost view instead of
 * a layout pass through every hosted Window. The accumulated gesture region is blanked before the
 * latest candidate is drawn, removing stale preview edges without repainting underlying content.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import type { Rect } from '../layout/index.js';
import type { ScreenBuffer, Style } from '@jsvision/core';

/** Single-line candidate glyphs; the serializer supplies the terminal's configured fallback. */
const OUTLINE = Object.freeze({ tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' });

/** Maximum deferred-preview cadence: fast enough for motion, bounded enough for terminal output. */
const PREVIEW_FRAME_MS = 33;

/** Signed resize motion retained per axis so a user reversal can bypass coalescing. */
interface ResizeDirection {
  readonly width: -1 | 0 | 1;
  readonly height: -1 | 0 | 1;
}

/** Topmost frame-only candidate that prevents deferred resizing from reflowing hosted content. */
export class ResizeOutline extends View {
  protected candidate: Rect | undefined;
  protected painted: Rect | undefined;
  protected base: ScreenBuffer | undefined;
  /** Time of the last motion-triggered repaint; the initial frame does not consume this allowance. */
  protected lastMotionPaintAt: number | undefined;
  /** One trailing repaint that adopts the newest candidate accumulated during the frame interval. */
  protected previewTimer: ReturnType<typeof setTimeout> | undefined;
  /** Last non-zero motion on each size axis; a reversal gets immediate visual feedback. */
  protected lastDirection: ResizeDirection | undefined;
  /** Allows one reversal repaint inside the current interval without letting pointer jitter bypass the cap. */
  protected reversalPaintedInInterval = false;

  constructor() {
    super();
    this.setLayout({ position: 'fill' });
    this.state.disabled = true;
  }

  /** Begin a preview at the Window's committed rectangle. */
  begin(rect: Rect, base: ScreenBuffer): void {
    this.cancelPreviewTimer();
    this.candidate = { ...rect };
    this.painted = undefined;
    this.base = base;
    this.lastMotionPaintAt = undefined;
    this.lastDirection = undefined;
    this.reversalPaintedInInterval = false;
    this.invalidate();
  }

  /** Repaint the latest candidate at a terminal-safe cadence without changing overlay layout. */
  update(rect: Rect): void {
    if (
      this.candidate !== undefined &&
      this.candidate.x === rect.x &&
      this.candidate.y === rect.y &&
      this.candidate.width === rect.width &&
      this.candidate.height === rect.height
    ) {
      return;
    }
    const previous = this.candidate;
    const direction = this.resizeDirection(previous, rect);
    const reversed = this.reversedDirection(this.lastDirection, direction);
    this.lastDirection = Object.freeze({
      width: direction.width === 0 ? (this.lastDirection?.width ?? 0) : direction.width,
      height: direction.height === 0 ? (this.lastDirection?.height ?? 0) : direction.height,
    });
    this.candidate = { ...rect };
    const now = performance.now();
    const elapsed = this.lastMotionPaintAt === undefined ? PREVIEW_FRAME_MS : Math.max(0, now - this.lastMotionPaintAt);
    const intervalAvailable = elapsed >= PREVIEW_FRAME_MS;
    const reversalAvailable = reversed && !this.reversalPaintedInInterval;
    if (intervalAvailable || reversalAvailable) {
      this.cancelPreviewTimer();
      this.lastMotionPaintAt = now;
      this.reversalPaintedInInterval = !intervalAvailable && reversalAvailable;
      this.invalidate();
      return;
    }
    if (this.previewTimer !== undefined) return;
    const delay = Math.max(0, Math.min(PREVIEW_FRAME_MS, PREVIEW_FRAME_MS - elapsed));
    this.previewTimer = setTimeout(() => this.paintLatestCandidate(), delay);
  }

  /** Stop painting the preview; the caller schedules the one restorative layout pass. */
  finish(): void {
    this.cancelPreviewTimer();
    this.candidate = undefined;
    this.painted = undefined;
    this.base = undefined;
    this.lastMotionPaintAt = undefined;
    this.lastDirection = undefined;
    this.reversalPaintedInInterval = false;
  }

  /** Paint the newest accumulated candidate inside the host's normal synchronous frame boundary. */
  protected paintLatestCandidate(): void {
    this.previewTimer = undefined;
    if (this.candidate === undefined || this.base === undefined || this.sameRect(this.candidate, this.painted)) return;
    this.lastMotionPaintAt = performance.now();
    this.reversalPaintedInInterval = false;
    const repaint = (): void => this.invalidate();
    if (this.host?.runTask !== undefined) this.host.runTask(repaint);
    else repaint();
  }

  /** Cancel delayed preview ownership before a gesture ends or a new one begins. */
  protected cancelPreviewTimer(): void {
    if (this.previewTimer === undefined) return;
    clearTimeout(this.previewTimer);
    this.previewTimer = undefined;
  }

  /** Compare optional candidate rectangles without allocating a normalized fallback. */
  protected sameRect(left: Rect, right: Rect | undefined): boolean {
    return (
      right !== undefined &&
      left.x === right.x &&
      left.y === right.y &&
      left.width === right.width &&
      left.height === right.height
    );
  }

  /** Resolve the signed width/height change between two consecutive pointer candidates. */
  protected resizeDirection(previous: Rect | undefined, next: Rect): ResizeDirection {
    const sign = (value: number): -1 | 0 | 1 => (value < 0 ? -1 : value > 0 ? 1 : 0);
    return Object.freeze({
      width: sign(next.width - (previous?.width ?? next.width)),
      height: sign(next.height - (previous?.height ?? next.height)),
    });
  }

  /** Return whether either actively moving axis reversed since the preceding candidate. */
  protected reversedDirection(previous: ResizeDirection | undefined, next: ResizeDirection): boolean {
    if (previous === undefined) return false;
    return (
      (next.width !== 0 && previous.width !== 0 && next.width !== previous.width) ||
      (next.height !== 0 && previous.height !== 0 && next.height !== previous.height)
    );
  }

  override draw(ctx: DrawContext): void {
    const candidate = this.candidate;
    const base = this.base;
    if (candidate === undefined || base === undefined) return;
    if (this.painted !== undefined) this.restorePerimeter(ctx, base, this.painted);
    const style = ctx.color('window');
    this.drawPerimeter(ctx, candidate, style);
    this.painted = { ...candidate };
  }

  /** Restore only the prior outline cells from the immutable pre-gesture frame. */
  protected restorePerimeter(ctx: DrawContext, base: ScreenBuffer, rect: Rect): void {
    this.visitPerimeter(rect, (x, y) => {
      const cell = base.get(x, y);
      if (cell === undefined) return;
      const source = cell.width === 0 ? base.get(x - 1, y) : cell;
      if (source === undefined || source.width === 0) return;
      const sourceX = cell.width === 0 ? x - 1 : x;
      ctx.text(sourceX, y, source.char, { fg: source.fg, bg: source.bg, attrs: source.attrs });
    });
  }

  /** Draw a transparent-interior frame plus bounded size feedback on its top edge. */
  protected drawPerimeter(ctx: DrawContext, rect: Rect, style: Style): void {
    const right = rect.x + rect.width - 1;
    const bottom = rect.y + rect.height - 1;
    ctx.text(rect.x, rect.y, OUTLINE.tl, style);
    ctx.text(right, rect.y, OUTLINE.tr, style);
    ctx.text(rect.x, bottom, OUTLINE.bl, style);
    ctx.text(right, bottom, OUTLINE.br, style);
    for (let x = rect.x + 1; x < right; x += 1) {
      ctx.text(x, rect.y, OUTLINE.h, style);
      ctx.text(x, bottom, OUTLINE.h, style);
    }
    for (let y = rect.y + 1; y < bottom; y += 1) {
      ctx.text(rect.x, y, OUTLINE.v, style);
      ctx.text(right, y, OUTLINE.v, style);
    }
    const label = ` ${rect.width}×${rect.height} `;
    if (label.length <= rect.width - 2) ctx.text(rect.x + 1, rect.y, label, style);
  }

  /** Visit a rectangle's perimeter cells once each, including corners. */
  protected visitPerimeter(rect: Rect, visit: (x: number, y: number) => void): void {
    const right = rect.x + rect.width - 1;
    const bottom = rect.y + rect.height - 1;
    for (let x = rect.x; x <= right; x += 1) {
      visit(x, rect.y);
      if (bottom !== rect.y) visit(x, bottom);
    }
    for (let y = rect.y + 1; y < bottom; y += 1) {
      visit(rect.x, y);
      if (right !== rect.x) visit(right, y);
    }
  }
}
