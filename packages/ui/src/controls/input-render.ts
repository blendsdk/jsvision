/**
 * Display-math helpers for {@link Input} (RD-06/07), extracted so `input.ts` stays under the
 * 500-line cap (packaging AC). Pure functions over the value string + the horizontal-scroll offset
 * (`firstPos`) — no instance state — faithful to Turbo Vision `TInputLine::draw` (`tinputli.cpp`).
 * The `.js` extension is required by NodeNext ESM resolution.
 */

/** Left/right scroll arrows (TV `tvtext1.cpp:106-107`, `0x11`/`0x10`), unambiguous-narrow code points. */
export const LEFT_ARROW = '◄'; // ◄
export const RIGHT_ARROW = '►'; // ►

/**
 * Whether text extends past the right edge of the field (TV `canScroll(1)`, `tinputli.cpp:118`).
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
 * The display column of a value index (TV `displayedPos` = `strwidth(data[0..pos))`). Code-unit in
 * v1 (PA-1); grapheme/wide-aware stepping is DEF-21 — the identity in the current slice.
 *
 * @param pos A JS string index into the value.
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
