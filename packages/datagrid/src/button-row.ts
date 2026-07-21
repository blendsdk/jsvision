/**
 * A single row of command buttons that all share one width and each sit centered in an equal cell.
 *
 * Every button is sized to the **widest** button's natural face width — not to its own label — so a
 * row stays uniform when the labels differ in length, and stays uniform as those labels change
 * (for example under localization, where `Apply` might become a much longer word). Each button is
 * then centered within its own equal-width cell, so the group reads as a balanced, evenly-spaced bar
 * regardless of how much room the row is given.
 */
import { Group, Button, row, grow, fixed } from '@jsvision/ui';

/** A button face is two rows tall: one content row plus the drop-shadow row beneath it. */
const BUTTON_HEIGHT = 2;

/** Cells between adjacent button cells. */
const BUTTON_GAP = 1;

/**
 * The minimum width a {@link buttonRow} needs to lay its buttons out without clipping: every cell at
 * the shared button width, plus one gap between each pair. A container narrower than this clips the
 * buttons; a wider one distributes the slack evenly and keeps each button centered in its cell.
 *
 * @param buttons The buttons that will share the row.
 * @returns The row's minimum content width in cells (`0` for an empty row).
 * @example
 * import { Button } from '@jsvision/ui';
 * import { buttonRowMinWidth } from './button-row.js';
 *
 * const width = buttonRowMinWidth([new Button('Select All'), new Button('Apply')]);
 * // size the popup that hosts the row to at least `width`
 */
export function buttonRowMinWidth(buttons: readonly Button[]): number {
  if (buttons.length === 0) return 0;
  const cellW = buttonCellWidth(buttons);
  return cellW * buttons.length + BUTTON_GAP * (buttons.length - 1);
}

/**
 * The shared per-button width: the widest button's natural face width (`measure().width`). Pass the
 * union of several rows' buttons to size them all alike (so, e.g., every button in a popup lines up).
 *
 * @param buttons The buttons to measure.
 * @returns The widest natural face width in cells (`0` for an empty set).
 * @example
 * import { Button } from '@jsvision/ui';
 * import { buttonCellWidth, buttonRow } from './button-row.js';
 *
 * const apply = new Button('Apply');
 * const clear = new Button('Clear');
 * const selectAll = new Button('Select All');
 * const width = buttonCellWidth([apply, clear, selectAll]); // one width for every row
 * const bar = buttonRow([apply, clear], width);
 */
export function buttonCellWidth(buttons: readonly Button[]): number {
  let max = 0;
  for (const b of buttons) max = Math.max(max, b.measure().width);
  return max;
}

/**
 * Build a horizontal row of equal-width, individually-centered command buttons.
 *
 * The returned `Group` is a flow container (`direction: 'row'`) two rows tall. Add it to a `col`
 * layout as a fixed-height child, or place it with an absolute rect using `at(bar, rect)`, which
 * merges the placement in so the row direction and gap survive. Give the row at least
 * {@link buttonRowMinWidth} cells of width so nothing clips.
 *
 * @param buttons The buttons to arrange, left to right. They are mutated to the shared width.
 * @param cellW An explicit per-button width to force (from {@link buttonCellWidth} over several rows,
 *   so multiple rows match); omit to size to this row's own widest button.
 * @returns A two-row `Group` containing each button centered in its own equal-width cell.
 * @example
 * import { Button } from '@jsvision/ui';
 * import { buttonRow } from './button-row.js';
 *
 * const selectAll = new Button('Select All', { onClick: () => {} });
 * const apply = new Button('Apply', { onClick: () => {} });
 * const bar = buttonRow([selectAll, apply]); // both render 'Select All'-wide, centered
 */
export function buttonRow(buttons: readonly Button[], cellW?: number): Group {
  const width = cellW ?? buttonCellWidth(buttons);
  // The gap is carried on the builder, not left to a tagger: `fixed` writes only the size, and
  // `buttonRowMinWidth` reserves room for these gaps, so losing one shifts every button after the first.
  const bar = fixed(row({ gap: BUTTON_GAP }), BUTTON_HEIGHT);
  for (const button of buttons) {
    // Fix the button to the shared width; its height stretches to the row (the cross axis).
    fixed(button, width);
    // An equal-share cell that centers the fixed-width button horizontally within it.
    bar.add(grow(row({ justify: 'center' }, button)));
  }
  return bar;
}
