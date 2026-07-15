/**
 * Display-math helpers for {@link Input}: pure functions over the value string and the
 * horizontal-scroll offset (`firstPos`). They decide when the scroll arrows appear and which glyph
 * belongs in each visible column. No instance state, so they are easy to test in isolation.
 */
import type { DrawContext } from '../view/index.js';
import type { Style } from '@jsvision/core';

/** The left / right scroll arrows shown when the value is scrolled horizontally. */
export const LEFT_ARROW = '◄';
export const RIGHT_ARROW = '►';

/** A snapshot of the render-relevant field state that {@link paintInput} draws. */
export interface InputPaintState {
  /** The value string being edited. */
  readonly value: string;
  /** Whether the field is focused (drives the colour role, selection band, and caret). */
  readonly focused: boolean;
  /** Selection start index (inclusive); `selStart === selEnd` means no selection. */
  readonly selStart: number;
  /** Selection end index (exclusive). */
  readonly selEnd: number;
  /** The caret index into the value. */
  readonly curPos: number;
  /** First visible value index (the horizontal-scroll offset). */
  readonly firstPos: number;
  /** A muted hint painted only while the value is empty; never part of the value. */
  readonly placeholder?: string;
}

/**
 * Whether text extends past the right edge of the field (i.e. a `►` arrow should show).
 *
 * @param v        The value string.
 * @param w        The field width in cells.
 * @param firstPos The first visible value index (horizontal scroll offset).
 * @returns `true` when a `►` arrow should show / a right-scroll is possible.
 */
export function canScrollRight(v: string, w: number, firstPos: number): boolean {
  return v.length - firstPos + 2 > w;
}

/**
 * The display column of a value index. Currently a straight identity (one string index = one
 * column); it exists as a seam so wide/grapheme-aware column stepping can be added later without
 * touching callers.
 *
 * @param pos A string index into the value.
 * @returns The display column offset from the start of the value.
 */
export function displayedPos(pos: number): number {
  return pos;
}

/**
 * The glyph to draw at display column `col`: the ◄/► edge arrow when scrolled, else the value
 * character shown there (col 1 → `firstPos`), else a space.
 *
 * @param col      The view-local display column.
 * @param v        The value string.
 * @param w        The field width in cells.
 * @param firstPos The first visible value index (horizontal scroll offset).
 * @returns The single glyph for that cell.
 */
export function glyphAt(col: number, v: string, w: number, firstPos: number): string {
  if (col === 0 && firstPos > 0) return LEFT_ARROW;
  if (col === w - 1 && canScrollRight(v, w, firstPos)) return RIGHT_ARROW;
  const idx = col - 1 + firstPos; // the value index shown at this column (col 1 → firstPos)
  return idx >= 0 && idx < v.length ? (v[idx] ?? ' ') : ' ';
}

/**
 * Resolve a placeholder option to a display string: a plain string as-is, a getter/signal by calling
 * it, and `undefined` to the empty string (no placeholder).
 *
 * @param p A placeholder string, a `() => string` getter (a signal is one), or `undefined`.
 * @returns The resolved placeholder text (`''` when unset).
 */
export function resolvePlaceholder(p: string | (() => string) | undefined): string {
  return p === undefined ? '' : typeof p === 'function' ? p() : p;
}

/**
 * Paint a single-line input field: the scrolled value at column 1, the ◄/► edge arrows, the visible
 * part of any selection band, and a visible caret drawn by reversing the edit cell (so the caret
 * shows even on terminals that hide the hardware cursor, and in headless rendering).
 *
 * @param ctx The clipped, view-local paint context.
 * @param s   The render-relevant field state (value, focus, selection, caret, scroll offset).
 */
export function paintInput(ctx: DrawContext, s: InputPaintState): void {
  const { value: v, focused, selStart, selEnd, curPos, firstPos } = s;
  const style = ctx.color(focused ? 'inputSelected' : 'inputNormal');
  const arrows = ctx.color('inputArrows');
  const { width: w, height: h } = ctx.size;
  ctx.fillRect(0, 0, w, h, ' ', style);
  if (w > 1) ctx.text(1, 0, v.slice(firstPos, firstPos + (w - 1)), style); // text starts at column 1
  // Placeholder: a muted hint shown ONLY over an empty value. It is display-only — it takes no part in
  // the selection/scroll/caret math and is never the bound value; a focused caret still overlays col 1.
  if (v === '' && s.placeholder && w > 1) {
    const muted: Style = { fg: ctx.color('staticText').fg, bg: style.bg }; // static-text fg on the field bg
    ctx.text(1, 0, s.placeholder.slice(0, w - 1), muted); // clipped to width, starts at col 1
  }
  if (canScrollRight(v, w, firstPos)) ctx.text(w - 1, 0, RIGHT_ARROW, arrows);
  if (firstPos > 0) ctx.text(0, 0, LEFT_ARROW, arrows);
  // Highlight the visible part of the selection, only when focused with a non-empty selection.
  if (focused && selStart < selEnd) {
    const l = Math.max(0, displayedPos(selStart) - firstPos);
    const r = Math.min(w - 2, displayedPos(selEnd) - firstPos);
    if (l < r) {
      const seg = v.slice(firstPos + l, firstPos + r); // the characters inside the band
      ctx.text(l + 1, 0, seg, ctx.color('inputSelection'));
    }
  }
  // Draw the caret LAST by repainting the edit cell with the field colours reversed, reusing whatever
  // glyph already sits there (a character or an edge arrow) so the caret overlays rather than erases it.
  if (focused) {
    const caretCol = displayedPos(curPos) - firstPos + 1;
    if (caretCol >= 0 && caretCol < w) {
      const reversed: Style = { fg: style.bg, bg: style.fg }; // field fg/bg swapped
      ctx.text(caretCol, 0, glyphAt(caretCol, v, w, firstPos), reversed);
    }
  }
}
