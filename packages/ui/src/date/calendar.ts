/**
 * {@link Calendar} — a focusable month-grid view for selecting a day. It shows a month at a time with a
 * header, a weekday row, and a 6×7 day grid, and lets the user move a day cursor and commit a day.
 *
 * Interaction:
 * - **Keyboard** — arrows move the cursor one day / one week; `PageUp`/`PageDown` change the month
 *   (with `Ctrl`, the year); `Home`/`End` jump to the start/end of the cursor's week; `+`/`-` page the
 *   visible month without moving the cursor; `T` jumps to today; `Enter`/`Space` commit the cursor.
 * - **Mouse** — the header `↑↓` arrows change the visible month (left) and year (right); clicking a day
 *   moves the cursor there and commits it; the footer `Today` button (comfortable/spacious densities)
 *   jumps to and selects today.
 *
 * Behaviour and options:
 * - **Selection** is a two-way `value` signal (`null` = nothing selected).
 * - **Bounds** — `min`/`max` clamp both navigation and the visible month; a day outside the range (or
 *   one your `isDisabled` predicate rejects) is drawn dimmed and cannot be committed (a click/Enter on
 *   it is a no-op, though the cursor can still land there).
 * - **Density** — `'compact'` | `'comfortable'` (default) | `'spacious'` trades screen space for
 *   roominess; the comfortable/spacious layouts add a footer with the selected-date echo and a `Today`
 *   button.
 * - **`firstDayOfWeek`** (0 = Sunday, default; 1 = Monday) and an opt-in ISO week-number column.
 *
 * Use {@link Calendar.measure} to size the widget to the chosen density.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent, ThemeRoleName } from '../view/index.js';
import type { Size2D } from '../layout/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { CalendarDate } from './calendar-date.js';
import { addDays, addMonths, compare, dayOfWeek, fromDate, toISO } from './calendar-date.js';
import { buildMonthGrid } from './calendar-grid.js';
import type { MonthGrid } from './calendar-grid.js';
import { metricsFor, dayFieldX, weekdayLabelX, weekRowY, weekdayLabels, headerLine } from './calendar-metrics.js';
import type { CalendarDensity, CalendarMetrics } from './calendar-metrics.js';

/** Month names indexed 1-12 (index 0 unused). */
const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Options for a {@link Calendar}. */
export interface CalendarOptions {
  /** Two-way selected day (`null` = no selection). */
  value: Signal<CalendarDate | null>;
  /** The day to highlight as "today" (default: the system clock at construction; pass it for tests). */
  today?: CalendarDate;
  /** Inclusive navigation lower bound (the cursor never leaves `[min,max]`). */
  min?: CalendarDate;
  /** Inclusive navigation upper bound. */
  max?: CalendarDate;
  /** Predicate that dims a day: it stays navigable but cannot be committed. */
  isDisabled?: (date: CalendarDate) => boolean;
  /** 0 = Sunday (default) | 1 = Monday (ISO). */
  firstDayOfWeek?: 0 | 1;
  /** Opt-in leading ISO week-number column (default false; adds 3 columns). */
  showWeekNumbers?: boolean;
  /**
   * Layout density (default `'comfortable'`): `'compact'` is tightest (~20×8), `'comfortable'` is the
   * roomy default (4-wide cells + a `Today` footer, ~28×10), `'spacious'` adds breathing room (5-wide
   * cells + blank week spacers, ~35×15).
   */
  density?: CalendarDensity;
  /** Fired when `value` changes. */
  onChange?: (date: CalendarDate) => void;
}

/**
 * A focusable month-grid day picker. Navigates a day cursor by keyboard and commits a day on
 * Enter/Space or a single click.
 *
 * @example
 * import { Group, Calendar, signal, dayOfWeek, toISO } from '@jsvision/ui';
 * import type { CalendarDate } from '@jsvision/ui';
 *
 * const g = new Group();
 * const value = signal<CalendarDate | null>(null);
 *
 * const cal = new Calendar({
 *   value,
 *   firstDayOfWeek: 1,                 // Monday-first
 *   showWeekNumbers: true,
 *   isDisabled: (d) => dayOfWeek(d) === 0, // Sundays not selectable
 *   onChange: (d) => console.log('picked', toISO(d)),
 * });
 * const size = cal.measure();          // size the widget to the chosen density
 * cal.layout = { position: 'absolute', rect: { x: 1, y: 0, width: size.width, height: size.height } };
 * g.add(cal);
 */
export class Calendar extends View {
  /** The calendar takes focus so its day cursor and keymap are scoped to it. */
  override focusable = true;

  /** Two-way selected day (`null` = none). */
  readonly value: Signal<CalendarDate | null>;

  protected readonly todayDate: CalendarDate;
  protected readonly min?: CalendarDate;
  protected readonly max?: CalendarDate;
  protected readonly isDisabled?: (date: CalendarDate) => boolean;
  protected readonly firstDayOfWeek: 0 | 1;
  protected readonly showWeekNumbers: boolean;
  protected readonly onChange?: (date: CalendarDate) => void;
  /** Resolved layout geometry for the chosen density + week-number flag (computed once). */
  protected readonly metrics: CalendarMetrics;

  /** The shown month (reactive — month nav repaints). */
  protected readonly visibleYear: Signal<number>;
  protected readonly visibleMonth: Signal<number>;
  /** The focus cursor cell (starts at `value ?? today`, clamped into `[min,max]`). */
  protected readonly cursor: Signal<CalendarDate>;

  /**
   * @param opts The two-way `value` plus optional `today`/`min`/`max`/`isDisabled`/`firstDayOfWeek`/
   *   `showWeekNumbers`/`density`/`onChange`.
   */
  constructor(opts: CalendarOptions) {
    super();
    this.value = opts.value;
    this.todayDate = opts.today ?? fromDate(new Date());
    this.min = opts.min;
    this.max = opts.max;
    this.isDisabled = opts.isDisabled;
    this.firstDayOfWeek = opts.firstDayOfWeek ?? 0;
    this.showWeekNumbers = opts.showWeekNumbers ?? false;
    this.onChange = opts.onChange;
    this.metrics = metricsFor(opts.density ?? 'comfortable', this.showWeekNumbers);

    const initial = this.clampBounds(this.value() ?? this.todayDate);
    this.visibleYear = signal(initial.year);
    this.visibleMonth = signal(initial.month);
    this.cursor = signal(initial);

    // Repaint on any reactive change: value, cursor, the visible month, or a focus flip (the cursor is
    // drawn only while focused, so gaining/losing focus must repaint).
    this.onMount(() => {
      this.bind(() => {
        this.value();
        this.cursor();
        this.visibleYear();
        this.visibleMonth();
        this.focusSignal()();
      });
    });
  }

  /** Advertise the density's intrinsic size (width × height) for `auto` sizing. */
  override measure(): Size2D {
    return { width: this.metrics.width, height: this.metrics.height };
  }

  /** Clamp a date into `[min,max]` (only where the respective bound is set); the cursor never leaves it. */
  protected clampBounds(d: CalendarDate): CalendarDate {
    if (this.min !== undefined && compare(d, this.min) < 0) return this.min;
    if (this.max !== undefined && compare(d, this.max) > 0) return this.max;
    return d;
  }

  /** True when a date may be committed — not disabled and within `[min,max]`. */
  protected isCommittable(d: CalendarDate): boolean {
    if (this.isDisabled?.(d) === true) return false;
    if (this.min !== undefined && compare(d, this.min) < 0) return false;
    if (this.max !== undefined && compare(d, this.max) > 0) return false;
    return true;
  }

  /** Commit a date to `value` (+ `onChange`); a disabled or out-of-range date is a **no-op**. */
  protected commit(d: CalendarDate): void {
    if (!this.isCommittable(d)) return;
    this.value.set(d);
    this.onChange?.(d);
  }

  /** Move the cursor (clamped), re-pointing the visible month when the target's month differs. */
  protected moveCursor(target: CalendarDate): void {
    const clamped = this.clampBounds(target);
    this.cursor.set(clamped);
    if (clamped.year !== this.visibleYear() || clamped.month !== this.visibleMonth()) {
      this.visibleYear.set(clamped.year);
      this.visibleMonth.set(clamped.month);
    }
  }

  /**
   * Clamp a visible `(year, month)` into `[min,max]` at month granularity (a bound's day is ignored):
   * the visible view can never page earlier than `min`'s month nor later than `max`'s month (only where
   * the respective bound is set). Returns the clamped month via a linear month index.
   */
  protected clampVisibleMonth(year: number, month: number): { year: number; month: number } {
    let idx = year * 12 + (month - 1);
    if (this.min !== undefined) idx = Math.max(idx, this.min.year * 12 + (this.min.month - 1));
    if (this.max !== undefined) idx = Math.min(idx, this.max.year * 12 + (this.max.month - 1));
    return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
  }

  /**
   * Shift the visible month by `delta`, clamped to `[min,max]` (the cursor and value are untouched — the
   * `+`/`-` keys and the left header ↑↓ arrows). At a bound edge the shift is a no-op.
   */
  protected shiftMonth(delta: number): void {
    const d = addMonths({ year: this.visibleYear(), month: this.visibleMonth(), day: 1 }, delta);
    const { year, month } = this.clampVisibleMonth(d.year, d.month);
    this.visibleYear.set(year);
    this.visibleMonth.set(month);
  }

  /**
   * Shift the visible year by `delta` (month kept), clamped to `[min,max]` (the right header ↑↓ arrows).
   * Clamping can pull the month to the bound's month when the target year lands on a boundary year.
   */
  protected shiftYear(delta: number): void {
    const { year, month } = this.clampVisibleMonth(this.visibleYear() + delta, this.visibleMonth());
    this.visibleYear.set(year);
    this.visibleMonth.set(month);
  }

  /** The first (or last) day of the cursor's displayed week (rotated by `firstDayOfWeek`). */
  protected weekBoundary(cur: CalendarDate, which: 'first' | 'last'): CalendarDate {
    const offset = (dayOfWeek(cur) - this.firstDayOfWeek + 7) % 7;
    const first = addDays(cur, -offset);
    return which === 'first' ? first : addDays(first, 6);
  }

  /** Programmatically commit a day (respects disabled/bounds — a no-op if the day is not committable). */
  select(date: CalendarDate): void {
    this.commit(date);
  }

  /** Move the cursor + visible month to today. */
  today(): void {
    const t = this.clampBounds(this.todayDate);
    this.cursor.set(t);
    this.visibleYear.set(t.year);
    this.visibleMonth.set(t.month);
  }

  /** Change the visible month only (value + cursor unchanged). */
  goToMonth(year: number, month: number): void {
    this.visibleYear.set(year);
    this.visibleMonth.set(month);
  }

  /** Build the current month's grid (pure; shared by draw + mouse hit-test). */
  protected currentGrid(): MonthGrid {
    return buildMonthGrid(this.visibleYear(), this.visibleMonth(), {
      firstDayOfWeek: this.firstDayOfWeek,
      weekNumbers: this.showWeekNumbers,
    });
  }

  /**
   * Resolve a day cell's theme colour by precedence: cursor (only while focused) > selected > today >
   * disabled > normal.
   */
  protected cellRole(date: CalendarDate): ThemeRoleName {
    const focused = this.state.focused;
    if (focused && compare(date, this.cursor()) === 0) return 'calendarCursor';
    const val = this.value();
    if (val !== null && compare(date, val) === 0) return 'calendarSelected';
    if (compare(date, this.todayDate) === 0) return 'calendarToday';
    if (this.isDisabled?.(date) === true) return 'calendarDisabled';
    return 'calendarNormal';
  }

  /** Paint the header, weekday row, 6 grid rows, and (comfortable/spacious) the footer, per the metrics. */
  draw(ctx: DrawContext): void {
    const m = this.metrics;
    const normal = ctx.color('calendarNormal');
    ctx.fill(' ', normal); // the whole grid background is the normal (cyan) fill

    // Row 0 — the header: month ↑↓ at the left, the centred month/year, year ↑↓ at the right.
    ctx.text(m.wkw, 0, headerLine(m, MONTH_NAMES[this.visibleMonth()], this.visibleYear()), normal);

    // The weekday-label row, rotated by firstDayOfWeek, at this density's cell width.
    const labels = weekdayLabels(m, this.firstDayOfWeek);
    for (let j = 0; j < 7; j += 1) ctx.text(weekdayLabelX(m, j), m.weekdayY, labels[j], normal);

    // The 6×7 day matrix; each in-month day is 2-digit right-justified at its day column.
    const grid = this.currentGrid();
    for (let i = 0; i < 6; i += 1) {
      const y = weekRowY(m, i);
      const wn = grid.weekNumbers[i];
      if (wn !== null) ctx.text(0, y, String(wn).padStart(2), ctx.color('calendarWeekNumber'));
      for (let j = 0; j < 7; j += 1) {
        const date = grid.rows[i][j];
        if (date === null) continue; // adjacent-month blank — the background fill already covers it
        ctx.text(dayFieldX(m, j), y, String(date.day).padStart(2), ctx.color(this.cellRole(date)));
      }
    }

    // Footer (comfortable/spacious) — a divider, the selected-date echo, and a Today button.
    if (m.footer !== null) {
      ctx.text(m.wkw, m.footer.dividerY, '─'.repeat(m.contentWidth), normal);
      const val = this.value();
      if (val !== null) ctx.text(m.wkw, m.footer.textY, toISO(val), normal);
      // The Today button borrows the "today" colour so it reads as the today affordance. The face is
      // padded (` Today `) so the coloured chip has breathing room; its width auto-sizes to the word.
      ctx.text(m.footer.todayX, m.footer.textY, m.footer.todayFace, ctx.color('calendarToday'));
    }
  }

  /**
   * Handle keyboard (cursor/month/year navigation + commit) and mouse (header arrows, footer Today,
   * day-click commit). Plain arrow keys are always consumed so navigation never leaves the calendar.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse' && inner.kind === 'down') {
      this.handleMouse(ev);
      return;
    }
    if (inner.type !== 'key') return;
    const cur = this.cursor();
    switch (inner.key) {
      case 'left':
        this.moveCursor(addDays(cur, -1));
        break;
      case 'right':
        this.moveCursor(addDays(cur, 1));
        break;
      case 'up':
        this.moveCursor(addDays(cur, -7));
        break;
      case 'down':
        this.moveCursor(addDays(cur, 7));
        break;
      case 'pageup':
        this.moveCursor(addMonths(cur, inner.ctrl ? -12 : -1));
        break;
      case 'pagedown':
        this.moveCursor(addMonths(cur, inner.ctrl ? 12 : 1));
        break;
      case 'home':
        this.moveCursor(this.weekBoundary(cur, 'first'));
        break;
      case 'end':
        this.moveCursor(this.weekBoundary(cur, 'last'));
        break;
      case 'enter':
      case 'space':
        this.commit(cur);
        break;
      case '+':
        this.shiftMonth(1);
        break;
      case '-':
        this.shiftMonth(-1);
        break;
      case 't':
      case 'T':
        this.today(); // jump the cursor + visible month to today
        break;
      default:
        return; // not a calendar key — leave unconsumed
    }
    ev.handled = true;
  }

  /** Header ↑↓ hit columns + the footer Today button + day-click commit — all keyed off the metrics. */
  protected handleMouse(ev: DispatchEvent): void {
    const local = ev.local;
    if (local === undefined) return;
    const m = this.metrics;
    if (local.y === 0) {
      // Header row: month ↑↓ at the far left, year ↑↓ at the far right (up = +1, down = −1).
      if (local.x === m.monthUpX) this.shiftMonth(1);
      else if (local.x === m.monthDownX) this.shiftMonth(-1);
      else if (local.x === m.yearUpX) this.shiftYear(1);
      else if (local.x === m.yearDownX) this.shiftYear(-1);
      else return;
      ev.handled = true;
      return;
    }
    // Footer `Today` button (comfortable/spacious): navigate to today AND select it. In a DatePicker the
    // commit fires onChange, closing the popup with today filled in; if today is disabled or out of
    // range the commit is a no-op and it just navigates there.
    if (m.footer !== null && local.y === m.footer.textY) {
      if (local.x >= m.footer.todayX && local.x < m.footer.todayX + m.footer.todayW) {
        this.today();
        this.commit(this.todayDate);
        ev.handled = true;
      }
      return;
    }
    // Day grid — find the week row whose y matches, then the cell column (blank between-week rows miss).
    const dx = local.x - m.wkw;
    if (dx < 0) return;
    const j = Math.floor(dx / m.cellWidth);
    if (j > 6) return;
    for (let i = 0; i < 6; i += 1) {
      if (weekRowY(m, i) !== local.y) continue;
      const date = this.currentGrid().rows[i][j];
      if (date === null) return;
      this.moveCursor(date); // a single click moves the cursor there…
      this.commit(date); // …and commits (a no-op if the day is disabled or out of range)
      ev.handled = true;
      return;
    }
  }
}
