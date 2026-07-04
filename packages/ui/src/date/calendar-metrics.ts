/**
 * `calendar-metrics.ts` — pure, view-free layout geometry for the RD-20 `Calendar` at three densities
 * (PA-20-runtime, user request 2026-07-04). Split out of `calendar.ts` so that file stays ≤ 500 lines
 * and the geometry is unit-testable in isolation. No reactivity, no drawing.
 *
 * A `density` selects how much room the month grid gets:
 *   • **compact**     — the TV-exact `TCalendarView` 20×8 (2-char weekday labels, 2-wide day cells at
 *                       `j*3`, no footer). The faithful decode (`calendar.cpp`); the geometry oracle.
 *   • **comfortable** — the modern default: 4-wide day cells, 3-letter weekday labels, a divider + a
 *                       footer row hosting the selected-date echo and a `[ Today ]` button (~28×10).
 *   • **spacious**    — comfortable + 5-wide cells and a blank spacer row between weeks (~35×15).
 *
 * The **header** is common to all densities: `↑↓` + a centred `⟨month⟩ ⟨year⟩` block + `↑↓`, exactly
 * `width` wide. The `↑↓` flanking arrows (PA-18) sit at the far left (month ±1) and far right (year ±1);
 * `compact` is byte-identical to the shipped header (the centred right-justified `setw(9)`/`setw(4)`
 * block reproduces `↑↓ September 2026 ↑↓`).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */

/** How much room the month grid gets. `compact` = the TV-exact 20×8; `comfortable` = the default. */
export type CalendarDensity = 'compact' | 'comfortable' | 'spacious';

/** Header nav arrows — thin `↑` (increment / next) / `↓` (decrement / prev), matching the dropdown `↓`. */
export const ARROW_UP = '↑';
export const ARROW_DOWN = '↓';

/** The `[ Today ]` footer button label (comfortable / spacious only). */
export const TODAY_LABEL = '[ Today ]';

/** Sunday-first weekday labels at the two supported widths; rotated by `firstDayOfWeek`. */
const WEEKDAY_2 = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const WEEKDAY_3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** The footer geometry (comfortable / spacious): the divider row + the selected-echo / Today-button row. */
export interface CalendarFooter {
  /** Row `y` of the horizontal `─` divider. */
  readonly dividerY: number;
  /** Row `y` of the selected-date echo (left) + the `[ Today ]` button (right). */
  readonly textY: number;
  /** Start column of the `[ Today ]` button. */
  readonly todayX: number;
  /** Width of the `[ Today ]` button (`TODAY_LABEL.length`). */
  readonly todayW: number;
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
 * @returns The resolved geometry.
 */
export function metricsFor(density: CalendarDensity, showWeekNumbers: boolean): CalendarMetrics {
  const s = SHAPES[density];
  const wkw = showWeekNumbers ? 3 : 0;
  // Rightmost day field = 6*cellWidth + dayInset + 1 (the 2-digit occupies dayInset..dayInset+1); +1 → width.
  const contentWidth = 6 * s.cellWidth + s.dayInset + 2;
  const width = wkw + contentWidth;

  const weekdayY = 1;
  const firstWeekY = 2;
  const lastWeekBottom = firstWeekY + 5 * s.weekStride; // y of the 6th (last) week row

  let footer: CalendarFooter | null = null;
  let height = lastWeekBottom + 1; // compact: rows 0..7 → height 8
  if (s.footer) {
    const dividerY = lastWeekBottom + 1;
    const textY = dividerY + 1;
    footer = { dividerY, textY, todayX: wkw + contentWidth - TODAY_LABEL.length, todayW: TODAY_LABEL.length };
    height = textY + 1;
  }

  return {
    density,
    width,
    height,
    wkw,
    contentWidth,
    cellWidth: s.cellWidth,
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

/** The rotated weekday labels at this density's width. */
export function weekdayLabels(m: CalendarMetrics, firstDayOfWeek: 0 | 1): string[] {
  const base = m.weekdayLen === 2 ? WEEKDAY_2 : WEEKDAY_3;
  return base.map((_, j) => base[(j + firstDayOfWeek) % 7]);
}

/** Centre `s` in `width` columns (extra padding, if odd, goes on the right). */
function centre(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  const left = Math.floor((width - s.length) / 2);
  return ' '.repeat(left) + s + ' '.repeat(width - s.length - left);
}

/**
 * The full `width`-wide header line: `↑↓` + a centred right-justified `setw(9)⟨month⟩ setw(4)⟨year⟩`
 * block + `↑↓`. `compact` reproduces the shipped `↑↓ September 2026 ↑↓` byte-for-byte.
 *
 * @param m         The metrics (supplies `contentWidth`).
 * @param monthName The full month name (e.g. `"September"`).
 * @param year      The visible year.
 * @returns The header string (exactly `m.contentWidth` wide; drawn at `x = m.wkw`).
 */
export function headerLine(m: CalendarMetrics, monthName: string, year: number): string {
  const block = `${monthName.padStart(9)} ${String(year).padStart(4)}`;
  return `${ARROW_UP}${ARROW_DOWN}${centre(block, m.contentWidth - 4)}${ARROW_UP}${ARROW_DOWN}`;
}
