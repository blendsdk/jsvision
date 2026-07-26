/**
 * Pure, view-free layout geometry for {@link Calendar} at three densities. No reactivity, no drawing;
 * it resolves the exact rows, columns, and hit-zones the calendar draws for a given density and
 * week-number setting.
 *
 * A `density` selects how much room the month grid gets:
 *   • **compact**     — a tight 20×8 grid (2-char weekday labels, 2-wide day cells, no footer).
 *   • **comfortable** — the default: 4-wide day cells, 3-letter weekday labels, a divider, and a
 *                       footer row hosting the selected-date echo and a `Today` button (~28×10).
 *   • **spacious**    — comfortable plus 5-wide cells and a blank spacer row between weeks (~35×15).
 *
 * The **header** is common to all densities: `↑↓` at the far left (change month), a centred
 * `⟨month⟩ ⟨year⟩` block, and `↑↓` at the far right (change year), spanning exactly the content width.
 */
import { clipCellText, stringWidth } from '../controls/measure.js';

/** How much room the month grid gets. `compact` is tightest; `comfortable` is the default. */
export type CalendarDensity = 'compact' | 'comfortable' | 'spacious';

/** Header nav arrows — thin `↑` (increment / next) / `↓` (decrement / prev), matching the dropdown `↓`. */
export const ARROW_UP = '↑';
export const ARROW_DOWN = '↓';

/**
 * The `Today` footer button word (comfortable / spacious only). This is the single translatable unit;
 * the surrounding button chrome (brackets + padding) is derived by {@link todayButtonFace}, so changing
 * this word alone re-sizes the button automatically.
 */
export const TODAY_LABEL = 'Today';

/**
 * Render the footer button's visible face from its word: padded one space each side (no brackets), e.g.
 * `Today` → `" Today "`. The padding cells carry the button's colour, so the button reads as a chip with
 * breathing room. Measure the returned face with `stringWidth`, so translated wide and combining
 * glyphs grow the button by the same number of cells the renderer uses.
 *
 * @param word The button word (default {@link TODAY_LABEL}).
 * @returns The face string to draw, e.g. `" Today "`.
 */
export function todayButtonFace(word: string = TODAY_LABEL): string {
  return ` ${word} `;
}

/** Sunday-first weekday labels at the two supported widths; rotated by `firstDayOfWeek`. */
const WEEKDAY_2 = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const WEEKDAY_3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** The footer geometry (comfortable / spacious): the divider row + the selected-echo / Today-button row. */
export interface CalendarFooter {
  /** Row `y` of the horizontal `─` divider. */
  readonly dividerY: number;
  /** Row `y` of the selected-date echo (left) + the `Today` button (right). */
  readonly textY: number;
  /** Start column of the `Today` button. */
  readonly todayX: number;
  /** Display-cell width of the `Today` button's padded face. */
  readonly todayW: number;
  /** The rendered button face to draw, e.g. `" Today "` — the space-padded {@link TODAY_LABEL}. */
  readonly todayFace: string;
}

/** The fully-resolved geometry for a `(density, showWeekNumbers)` pair. All columns are absolute. */
export interface CalendarMetrics {
  readonly density: CalendarDensity;
  /** Full view width (incl. the week-number column when present). */
  readonly width: number;
  /** Full view height. */
  readonly height: number;
  /** Leading ISO week-number column width (0 or 3). */
  readonly wkw: number;
  /** Content width (= `width - wkw`), the header/divider span. */
  readonly contentWidth: number;
  /** Columns per weekday column. */
  readonly cellWidth: number;
  /** Offset of the 2-digit day field within a cell. */
  readonly dayInset: number;
  /** Offset of the weekday label within a cell. */
  readonly weekdayInset: number;
  /** Weekday label width (2 or 3). */
  readonly weekdayLen: number;
  /** Row `y` of the weekday-label row. */
  readonly weekdayY: number;
  /** Row `y` of the first week row. */
  readonly firstWeekY: number;
  /** Vertical stride between week rows (1 = packed, 2 = spacious blank-row spacing). */
  readonly weekStride: number;
  /** The footer geometry, or `null` (compact). */
  readonly footer: CalendarFooter | null;
  /** Header arrow hit columns (absolute; up = next/increment, down = prev/decrement). */
  readonly monthUpX: number;
  readonly monthDownX: number;
  readonly yearUpX: number;
  readonly yearDownX: number;
}

/** Per-density knobs (before the `wkw` offset + footer/height derivation). */
interface DensityShape {
  cellWidth: number;
  dayInset: number;
  weekdayInset: number;
  weekdayLen: 2 | 3;
  weekStride: number;
  footer: boolean;
}

const SHAPES: Record<CalendarDensity, DensityShape> = {
  compact: { cellWidth: 3, dayInset: 0, weekdayInset: 0, weekdayLen: 2, weekStride: 1, footer: false },
  comfortable: { cellWidth: 4, dayInset: 2, weekdayInset: 1, weekdayLen: 3, weekStride: 1, footer: true },
  spacious: { cellWidth: 5, dayInset: 3, weekdayInset: 2, weekdayLen: 3, weekStride: 2, footer: true },
};

/**
 * Resolve the full {@link CalendarMetrics} for a density + week-number flag. Pure.
 *
 * @param density         The chosen density.
 * @param showWeekNumbers Whether a leading 3-cell ISO week-number column is present.
 * @param todayLabel      The localized word used for the footer button.
 * @param monthNames      Localized month names whose widest display width must fit the header.
 * @param weekdayNames    Localized two- and three-cell weekday labels that may widen each day cell.
 * @returns The resolved geometry.
 */
export function metricsFor(
  density: CalendarDensity,
  showWeekNumbers: boolean,
  todayLabel: string = TODAY_LABEL,
  monthNames: readonly string[] = [],
  weekdayNames?: { readonly short2: readonly string[]; readonly short3: readonly string[] },
): CalendarMetrics {
  const s = SHAPES[density];
  const selectedWeekdays = s.weekdayLen === 2 ? weekdayNames?.short2 : weekdayNames?.short3;
  const widestWeekday = selectedWeekdays?.reduce((width, label) => Math.max(width, stringWidth(label)), 0) ?? 0;
  const cellWidth = Math.max(s.cellWidth, s.weekdayInset + widestWeekday);
  const wkw = showWeekNumbers ? 3 : 0;
  // Rightmost day field = 6*cellWidth + dayInset + 1 (the 2-digit occupies dayInset..dayInset+1); +1 → width.
  const dayGridWidth = 6 * cellWidth + s.dayInset + 2;
  const weekdayGridWidth = 6 * cellWidth + s.weekdayInset + widestWeekday;
  const gridWidth = Math.max(dayGridWidth, weekdayGridWidth);
  const widestMonth = monthNames.reduce((width, month) => Math.max(width, stringWidth(month)), 0);
  const headerWidth = 4 + Math.max(9, widestMonth) + 1 + 4;
  const todayFace = todayButtonFace(todayLabel);
  const footerWidth = s.footer ? 10 + 1 + stringWidth(todayFace) : 0;
  const contentWidth = Math.max(gridWidth, headerWidth, footerWidth);
  const width = wkw + contentWidth;

  const weekdayY = 1;
  const firstWeekY = 2;
  const lastWeekBottom = firstWeekY + 5 * s.weekStride; // y of the 6th (last) week row

  let footer: CalendarFooter | null = null;
  let height = lastWeekBottom + 1; // compact: rows 0..7 → height 8
  if (s.footer) {
    const dividerY = lastWeekBottom + 1;
    const textY = dividerY + 1;
    // The button width auto-derives from its (translatable) word + padding, so it right-aligns correctly
    // whatever the word — a single source of truth shared by the draw (via `todayFace`) and the hit-zone.
    const todayWidth = stringWidth(todayFace);
    footer = {
      dividerY,
      textY,
      todayX: wkw + contentWidth - todayWidth,
      todayW: todayWidth,
      todayFace,
    };
    height = textY + 1;
  }

  return {
    density,
    width,
    height,
    wkw,
    contentWidth,
    cellWidth,
    dayInset: s.dayInset,
    weekdayInset: s.weekdayInset,
    weekdayLen: s.weekdayLen,
    weekdayY,
    firstWeekY,
    weekStride: s.weekStride,
    footer,
    monthUpX: wkw + 0,
    monthDownX: wkw + 1,
    yearUpX: wkw + contentWidth - 2,
    yearDownX: wkw + contentWidth - 1,
  };
}

/** Absolute column of day-index `j`'s 2-digit field. */
export function dayFieldX(m: CalendarMetrics, j: number): number {
  return m.wkw + j * m.cellWidth + m.dayInset;
}

/** Absolute column of day-index `j`'s weekday label. */
export function weekdayLabelX(m: CalendarMetrics, j: number): number {
  return m.wkw + j * m.cellWidth + m.weekdayInset;
}

/** Row `y` of week row `i` (0-5). */
export function weekRowY(m: CalendarMetrics, i: number): number {
  return m.firstWeekY + i * m.weekStride;
}

/**
 * Returns weekday labels rotated to the configured first day.
 *
 * @param m Resolved calendar metrics, which select two- or three-cell labels.
 * @param firstDayOfWeek Sunday (`0`) or Monday (`1`).
 * @param labels Optional localized labels in Sunday-first order.
 * @returns Seven labels in display order.
 */
export function weekdayLabels(
  m: CalendarMetrics,
  firstDayOfWeek: 0 | 1,
  labels?: { readonly short2: readonly string[]; readonly short3: readonly string[] },
): string[] {
  const base =
    labels === undefined
      ? m.weekdayLen === 2
        ? WEEKDAY_2
        : WEEKDAY_3
      : m.weekdayLen === 2
        ? labels.short2
        : labels.short3;
  const available = Math.max(0, m.cellWidth - m.weekdayInset);
  return base.map((_, j) => clipCellText(base[(j + firstDayOfWeek) % 7] ?? '', available));
}

/** Centre `s` in `width` columns (extra padding, if odd, goes on the right). */
function centre(s: string, width: number): string {
  const clipped = clipCellText(s, width);
  const cells = stringWidth(clipped);
  if (cells >= width) return clipped;
  const left = Math.floor((width - cells) / 2);
  return ' '.repeat(left) + clipped + ' '.repeat(width - cells - left);
}

/**
 * The full content-width header line: `↑↓` at the left, a centred `⟨month⟩ ⟨year⟩` block (month
 * right-justified to 9 columns, year to 4), and `↑↓` at the right — e.g. `↑↓ September 2026 ↑↓`.
 *
 * @param m         The metrics (supplies `contentWidth`).
 * @param monthName The full month name (e.g. `"September"`).
 * @param year      The visible year.
 * @returns The header string (exactly `m.contentWidth` wide; drawn at `x = m.wkw`).
 */
export function headerLine(m: CalendarMetrics, monthName: string, year: number): string {
  if (m.contentWidth < 4) return clipCellText(`${ARROW_UP}${ARROW_DOWN}${ARROW_UP}${ARROW_DOWN}`, m.contentWidth);
  const monthPadding = Math.max(0, 9 - stringWidth(monthName));
  const block = `${' '.repeat(monthPadding)}${monthName} ${String(year).padStart(4)}`;
  return `${ARROW_UP}${ARROW_DOWN}${centre(block, m.contentWidth - 4)}${ARROW_UP}${ARROW_DOWN}`;
}

/**
 * Adapt intrinsic Calendar geometry to a smaller assigned width.
 *
 * The day-cell stride stays intrinsic, so dates do not jump columns. Header/footer affordances are
 * re-anchored to visible cells and their text is clipped by callers against this returned width.
 *
 * @param m Intrinsic localized metrics.
 * @param assignedWidth Live width assigned by the parent layout.
 * @returns Metrics whose interactive header/footer geometry fits the assigned width.
 */
export function fitCalendarMetrics(m: CalendarMetrics, assignedWidth: number): CalendarMetrics {
  const width = Number.isSafeInteger(assignedWidth) ? Math.max(0, Math.min(m.width, assignedWidth)) : m.width;
  if (width === m.width) return m;
  const wkw = Math.min(m.wkw, width);
  const contentWidth = Math.max(0, width - wkw);
  const footer =
    m.footer === null
      ? null
      : {
          ...m.footer,
          todayW: Math.min(m.footer.todayW, contentWidth),
          todayX: Math.max(wkw, width - Math.min(m.footer.todayW, contentWidth)),
          todayFace: clipCellText(m.footer.todayFace, contentWidth),
        };
  return {
    ...m,
    width,
    wkw,
    contentWidth,
    footer,
    monthUpX: wkw,
    monthDownX: Math.min(width - 1, wkw + 1),
    yearUpX: Math.max(wkw, width - 2),
    yearDownX: Math.max(wkw, width - 1),
  };
}
