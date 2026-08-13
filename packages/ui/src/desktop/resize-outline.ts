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

/** Topmost frame-only candidate that prevents deferred resizing from reflowing hosted content. */
export class ResizeOutline extends View {
  protected candidate: Rect | undefined;
  protected painted: Rect | undefined;
  protected base: ScreenBuffer | undefined;

  constructor() {
    super();
    this.setLayout({ position: 'fill' });
    this.state.disabled = true;
  }

  /** Begin a preview at the Window's committed rectangle. */
  begin(rect: Rect, base: ScreenBuffer): void {
    this.candidate = { ...rect };
    this.painted = undefined;
    this.base = base;
    this.invalidate();
  }

  /** Repaint the latest candidate without changing this full-Desktop view's layout. */
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
    this.candidate = { ...rect };
    this.invalidate();
  }

  /** Stop painting the preview; the caller schedules the one restorative layout pass. */
  finish(): void {
    this.candidate = undefined;
    this.painted = undefined;
    this.base = undefined;
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
