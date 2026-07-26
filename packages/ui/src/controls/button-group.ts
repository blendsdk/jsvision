import { col, fixed, grow, row } from '../view/index.js';
import type { Group } from '../view/index.js';
import type { Button } from './button.js';

/** A Button face contains one content row and one shadow row. */
const BUTTON_HEIGHT = 2;

/**
 * Cell-based options shared by Button-group measurement and composition.
 *
 * Every numeric option must be a finite whole number. Widths and gaps may be zero, while
 * `maxColumns` must be positive.
 */
export interface ButtonGroupOptions {
  /** Smallest width assigned to every Button. Defaults to the widest natural face. */
  readonly minimumButtonWidth?: number;
  /** Cells between adjacent Button faces in one row. Defaults to `0`. */
  readonly gap?: number;
  /** Maximum Buttons in one row. Omit to keep the complete group on one row. */
  readonly maxColumns?: number;
  /** Rows between wrapped Button rows. Defaults to {@link gap}. */
  readonly rowGap?: number;
}

/** Options accepted by the one-column convenience composer. */
export type ButtonColumnOptions = Pick<ButtonGroupOptions, 'minimumButtonWidth' | 'gap'>;

/**
 * Intrinsic terminal-cell geometry for one logical Button group.
 *
 * The metrics describe the smallest unclipped rectangle for the selected wrapping policy. A host
 * may allocate more room, but should not allocate less unless it intentionally provides a hard
 * clipping bound.
 */
export interface ButtonGroupMetrics {
  /** Equal width assigned to every Button face. */
  readonly buttonWidth: number;
  /** Number of Button columns in the widest composed row. */
  readonly columnCount: number;
  /** Number of composed rows. */
  readonly rowCount: number;
  /** Minimum width of the complete group, including horizontal gaps. */
  readonly width: number;
  /** Minimum height of the complete group, including wrapped-row gaps. */
  readonly height: number;
}

/** Fully validated options used by the pure metric and composer implementations. */
interface ResolvedButtonGroupOptions {
  readonly minimumButtonWidth: number;
  readonly gap: number;
  readonly maxColumns: number | undefined;
  readonly rowGap: number;
}

/**
 * Validate one public cell count.
 *
 * Fractional, infinite, and negative values cannot describe terminal cells. Rejecting them early
 * prevents layout behavior from depending on implicit rounding in a lower layer.
 */
function cellCount(name: string, value: number | undefined, fallback: number, positive = false): number {
  const resolved = value ?? fallback;
  const minimum = positive ? 1 : 0;
  if (!Number.isSafeInteger(resolved) || resolved < minimum) {
    throw new RangeError(`${name} must be a ${positive ? 'positive' : 'non-negative'} safe integer.`);
  }
  return resolved;
}

/** Resolve and validate the public metric options once. */
function resolveOptions(options: ButtonGroupOptions): ResolvedButtonGroupOptions {
  const gap = cellCount('gap', options.gap, 0);
  return {
    minimumButtonWidth: cellCount('minimumButtonWidth', options.minimumButtonWidth, 0),
    gap,
    maxColumns: options.maxColumns === undefined ? undefined : cellCount('maxColumns', options.maxColumns, 1, true),
    rowGap: cellCount('rowGap', options.rowGap, gap),
  };
}

/**
 * Measure an equal-width logical group of Buttons in terminal cells.
 *
 * Natural Button measurement is the single caption-width authority: it removes accelerator markup,
 * counts wide and combining glyphs exactly as the renderer does, and includes face padding and the
 * shadow column. The widest result is then compared with `minimumButtonWidth`.
 *
 * @param buttons Buttons that belong to the logical action group.
 * @param options Minimum width, gaps, and optional wrapping column limit.
 * @returns The group's smallest unclipped terminal-cell rectangle.
 * @example
 * import { Button, measureButtonGroup } from '@jsvision/ui';
 *
 * const buttons = [new Button('~O~K'), new Button('~C~ancel')];
 * const metrics = measureButtonGroup(buttons, { minimumButtonWidth: 10, gap: 2 });
 * // Use metrics.width when choosing the dialog's minimum width.
 */
export function measureButtonGroup(buttons: readonly Button[], options: ButtonGroupOptions = {}): ButtonGroupMetrics {
  const resolved = resolveOptions(options);
  if (buttons.length === 0) {
    return { buttonWidth: 0, columnCount: 0, rowCount: 0, width: 0, height: 0 };
  }

  let buttonWidth = resolved.minimumButtonWidth;
  for (const button of buttons) buttonWidth = Math.max(buttonWidth, button.measure().width);

  const columnCount = Math.min(buttons.length, resolved.maxColumns ?? buttons.length);
  const rowCount = Math.ceil(buttons.length / columnCount);
  return {
    buttonWidth,
    columnCount,
    rowCount,
    width: columnCount * buttonWidth + (columnCount - 1) * resolved.gap,
    height: rowCount * BUTTON_HEIGHT + (rowCount - 1) * resolved.rowGap,
  };
}

/**
 * Compose equal-width Buttons in stable row-major order.
 *
 * Each supplied Button must be unattached and appear only once. Composition assigns its fixed width
 * and parent, so sharing one live Button across multiple groups would corrupt both view trees.
 *
 * @param buttons Buttons to compose in source, focus, and accelerator order.
 * @param options Minimum width, gaps, and optional maximum columns per row.
 * @returns One row directly, or a vertical Group containing multiple equal-width Button rows.
 * @example
 * import { Button, buttonGroup } from '@jsvision/ui';
 *
 * const actions = [
 *   new Button('Save'),
 *   new Button('Apply'),
 *   new Button('Delete'),
 *   new Button('Set Default'),
 *   new Button('Reset'),
 * ];
 * const wrapped = buttonGroup(actions, { gap: 1, rowGap: 1, maxColumns: 3 });
 */
export function buttonGroup(buttons: readonly Button[], options: ButtonGroupOptions = {}): Group {
  const resolved = resolveOptions(options);
  const metrics = measureButtonGroup(buttons, options);
  const seen = new Set<Button>();
  for (const button of buttons) {
    if (button.parent !== null || seen.has(button)) {
      throw new TypeError('Each Button must be unattached and occur only once in a Button group.');
    }
    seen.add(button);
  }

  const rows: Group[] = [];
  for (let start = 0; start < buttons.length; start += metrics.columnCount) {
    const cells = buttons.slice(start, start + metrics.columnCount).map((button) => {
      const cell = row({ justify: 'center' }, fixed(button, metrics.buttonWidth));
      return grow(cell, 1, { min: metrics.buttonWidth });
    });
    rows.push(row({ gap: resolved.gap }, ...cells));
  }
  return rows.length === 1 ? rows[0] : col({ gap: resolved.rowGap }, ...rows);
}

/**
 * Compose one equal-width vertical column of Buttons.
 *
 * `gap` is the number of rows between Button faces. The configured minimum width is shared with
 * {@link buttonGroup}; wrapping options are intentionally absent because this helper always has one
 * column.
 *
 * @param buttons Buttons to stack in source and focus order.
 * @param options Minimum width and vertical gap.
 * @returns A one-column Button group.
 * @example
 * import { Button, buttonColumn } from '@jsvision/ui';
 *
 * const actions = buttonColumn([new Button('Open'), new Button('Cancel')], {
 *   minimumButtonWidth: 11,
 *   gap: 1,
 * });
 */
export function buttonColumn(buttons: readonly Button[], options: ButtonColumnOptions = {}): Group {
  return buttonGroup(buttons, {
    minimumButtonWidth: options.minimumButtonWidth,
    gap: 0,
    maxColumns: 1,
    rowGap: options.gap,
  });
}
