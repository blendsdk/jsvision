/**
 * Display-math helpers for {@link Input}: pure functions over the value string and the
 * horizontal-scroll offset (`firstPos`). They decide when the scroll arrows appear and which glyph
 * belongs in each visible column. No instance state, so they are easy to test in isolation.
 */

/** The left / right scroll arrows shown when the value is scrolled horizontally. */
export const LEFT_ARROW = '◄';
export const RIGHT_ARROW = '►';

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
