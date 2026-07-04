/**
 * `Calendar` — a focusable month-grid `View`, a **faithful decode** of Turbo Vision's `TCalendarView`
 * (`examples/tvdemo/calendar.cpp`, `calendar.h`) extended with a selectable day, a modern day-nav
 * cursor, min/max bounds, disabled days, an optional ISO week-number column, and a configurable
 * first-day-of-week (RD-20).
 *
 * ## TV decode (GATE-1/GATE-2 — `calendar.cpp`)
 *   • **View size 20×8** — window `TRect(1,1,23,11)` = 22×10 (`wnNoNumber`, `flags &= ~(wfZoom|wfGrow)`),
 *     `palette = wpCyanWindow`, inset `r.grow(-1,-1)` → the view is 20×8 (`calendar.cpp:268-281`). The
 *     `22` in `draw()` is an over-allocated buffer clipped to the 20-col view (PF-001).
 *   • **Row 0 header** — TV draws `setw(9)⟨month⟩ setw(4)⟨year⟩ ▲  ▼` (CP437 30/31 = ▲/▼ at col 15/18,
 *     both month nav, `calendar.cpp:139-144`). **RD-20 replaces this header** — see §Header extension.
 *   • **Month nav (mouse)** — TV: local `x=15,y=0 ⇒ ++month`; `x=18,y=0 ⇒ −−month` (`calendar.cpp:185-204`).
 *     RD-20 re-lays the hit zones (§Header extension); with a week-number column they shift right by
 *     `weekNumberColWidth` (AR-202 / AC-9).
 *   • **Month nav (keys)** — TV `+`/kbDown ⇒ next, `-`/kbUp ⇒ prev (`calendar.cpp:206-231`). RD-20
 *     reassigns the arrows to day-nav (AR-199) and keeps `+`/`-` for the visible month.
 *   • **Row 1 weekday** — `"Su Mo Tu We Th Fr Sa"` (`calendar.cpp:147`), rotated by `firstDayOfWeek`.
 *   • **Rows 2-7 grid** — 6×7; day `d` = `setw(2)` right-justified at col `j*3`; out-of-range = blank
 *     (`calendar.cpp:150-171`; PF-002 = no adjacent-month numbers).
 *   • **Colours** — normal `getColor(6)`→`cpCyanWindow[6]=0x15`→`cpAppColor[21]=0x3E` yellow-on-cyan;
 *     today `getColor(7)`→`cpCyanWindow[7]=0x16`→`cpAppColor[22]=0x21` blue-on-green (`calendar.cpp:134,163-166`).
 *
 * ## GATE-2 AFTER-diff (re-verified vs `calendar.cpp:124-171`, 2026-07-04)
 * The composed **grid** matches the decode cell-by-cell (the executable oracle is `calendar.spec`
 * ST-4 + geometry): weekday row `Su Mo Tu We Th Fr Sa`; days 2-digit right-justified at col `j*3` with
 * leading/trailing blanks; today `0x21` blue-on-green, other in-month days `0x3E` yellow-on-cyan. The
 * intentional deviations are documented extensions: leap rule → full Gregorian in `daysInMonth`
 * (AR-196); the additive selection/cursor/disabled/week# roles (which never perturb the TV grid cells
 * when unfocused + `value=null`, ST-2); and the header (§Header extension). No grid mismatch found.
 *
 * ## Header extension (RD-20 — user request 2026-07-04, NOT a TV decode)
 *   TV's right-only `▲/▼` month arrows are replaced by a **flanking** header `↑↓ ⟨month⟩ ⟨year⟩ ↑↓`
 *   (`'↑↓ '`+setw(9)month+`' '`+setw(4)year+`' ↑↓'` = 20 cols): the LEFT `↑↓` (cols 0-1) step the
 *   visible month ±1, the RIGHT `↑↓` (cols 18-19) step the visible year ±1 — up = next/increment, down
 *   = prev/decrement, both **clamped to `[min,max]`** at month granularity (`clampVisibleMonth`). The
 *   `↑`/`↓` (U+2191/U+2193) match the ComboBox/History dropdown `↓` (`dropdown/popup.ts:31`) so the
 *   date family shares one arrow style. Oracle: `calendar.spec` ST-3 (geometry) + ST-7 (nav + clamp).
 *
 * ## Extensions (no TV counterpart — spec oracles, no `.cpp` diff)
 *   selectable `value` (`calendarSelected` `0x1F`), the day-nav cursor (`calendarCursor` `0x3F`, drawn
 *   only while focused, precedence cursor > selected > today > disabled > normal, PA-4), min/max bounds,
 *   disabled days (`calendarDisabled` `0x38`), week numbers (`calendarWeekNumber` `0x30`, PA-10),
 *   firstDayOfWeek. The pure grid math lives in `calendar-grid.ts` (PA-6).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent, ThemeRoleName } from '../view/index.js';
import type { Size2D } from '../layout/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { CalendarDate } from './calendar-date.js';
import { addDays, addMonths, compare, dayOfWeek, fromDate } from './calendar-date.js';
import { buildMonthGrid, dayColumn } from './calendar-grid.js';
import type { MonthGrid } from './calendar-grid.js';

/** Month names indexed 1-12 (index 0 unused), matching `TCalendarView`'s `monthNames`. */
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

/**
 * Header nav arrows — thin `↑` (U+2191, increment / next) and `↓` (U+2193, decrement / prev). An
 * RD-20 extension replacing TV's filled `▲/▼` (`calendar.cpp:141`, CP437 30/31); the `↓` matches the
 * ComboBox/History dropdown icon (`DROPDOWN_ICON.arrow`, `dropdown/popup.ts:31`) so the date family
 * shares one arrow style (user request 2026-07-04).
 */
const ARROW_UP = '↑';
const ARROW_DOWN = '↓';

/** Options for a {@link Calendar}. (PA-8) */
export interface CalendarOptions {
  /** Two-way selected day (`null` = no selection). */
  value: Signal<CalendarDate | null>;
  /** "Today" to highlight (default: the system clock at construction, AR-200; injectable for tests). */
  today?: CalendarDate;
  /** Inclusive navigation lower bound (the cursor never leaves `[min,max]`; AC-8). */
  min?: CalendarDate;
  /** Inclusive navigation upper bound. */
  max?: CalendarDate;
  /** Dims a day (drawn `calendarDisabled`, navigable, non-committable). */
  isDisabled?: (date: CalendarDate) => boolean;
  /** 0 = Sunday (default, TV-faithful) | 1 = Monday (ISO). */
  firstDayOfWeek?: 0 | 1;
  /** Opt-in leading ISO week-number column (default false, adds 3 cols → the view is 23×8). */
  showWeekNumbers?: boolean;
  /** Fired when `value` changes via a commit (Should-Have, PA-8). */
  onChange?: (date: CalendarDate) => void;
}

/**
 * A focusable month-grid view. Draws the TV decode + the extensions; navigates a day cursor by
 * keyboard; commits a day on Enter/Space or a single click. See the module doc for the GATE-1 decode.
 */
export class Calendar extends View {
  /** TV `ofSelectable` — the calendar takes focus (the day cursor + keymap are focus-scoped). */
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

  /** The shown month (reactive — month nav repaints). */
  protected readonly visibleYear: Signal<number>;
  protected readonly visibleMonth: Signal<number>;
  /** The focus cursor cell (PA-9: init `value ?? today`, clamped into `[min,max]`). */
  protected readonly cursor: Signal<CalendarDate>;

  /**
   * @param opts The two-way `value` + optional `today`/`min`/`max`/`isDisabled`/`firstDayOfWeek`/
   *   `showWeekNumbers`/`onChange` (PA-8).
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

  /** Advertise the intrinsic 20×8 (or 23×8 with week numbers) size for `auto` sizing. */
  override measure(): Size2D {
    return { width: this.showWeekNumbers ? 23 : 20, height: 8 };
  }

  // ── Bounds / commit helpers ─────────────────────────────────────────────────────────────────────

  /** Clamp a date into `[min,max]` (only where the respective bound is set); the cursor never leaves it. */
  protected clampBounds(d: CalendarDate): CalendarDate {
    if (this.min !== undefined && compare(d, this.min) < 0) return this.min;
    if (this.max !== undefined && compare(d, this.max) > 0) return this.max;
    return d;
  }

  /** True when a date is disabled or out of `[min,max]` (a click/Enter on it is a no-op, AC-8). */
  protected isCommittable(d: CalendarDate): boolean {
    if (this.isDisabled?.(d) === true) return false;
    if (this.min !== undefined && compare(d, this.min) < 0) return false;
    if (this.max !== undefined && compare(d, this.max) > 0) return false;
    return true;
  }

  /** Commit a date to `value` (+ `onChange`); a disabled / out-of-range date is a **no-op** (AC-8). */
  protected commit(d: CalendarDate): void {
    if (!this.isCommittable(d)) return;
    this.value.set(d);
    this.onChange?.(d);
  }

  /** Move the cursor (clamped), re-pointing the visible month when the target's month differs (PA-9). */
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
   * Shift the visible month by `delta`, clamped to `[min,max]` (cursor + value untouched — the `+`/`-`
   * keys and the LEFT header ↑↓ arrows). At a bound edge the shift is a no-op (AC runtime: validate nav).
   */
  protected shiftMonth(delta: number): void {
    const d = addMonths({ year: this.visibleYear(), month: this.visibleMonth(), day: 1 }, delta);
    const { year, month } = this.clampVisibleMonth(d.year, d.month);
    this.visibleYear.set(year);
    this.visibleMonth.set(month);
  }

  /**
   * Shift the visible year by `delta` (month kept), clamped to `[min,max]` (the RIGHT header ↑↓ arrows).
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

  // ── Public methods (Should-Have, PA-8) ────────────────────────────────────────────────────────

  /** Programmatic commit (respects disabled/bounds → a no-op if invalid). */
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

  // ── Draw ─────────────────────────────────────────────────────────────────────────────────────

  /** Build the current month's grid (pure; shared by draw + mouse hit-test). */
  protected currentGrid(): MonthGrid {
    return buildMonthGrid(this.visibleYear(), this.visibleMonth(), {
      firstDayOfWeek: this.firstDayOfWeek,
      weekNumbers: this.showWeekNumbers,
    });
  }

  /** Resolve a day cell's theme role by the PA-4 precedence (cursor drawn only while focused). */
  protected cellRole(date: CalendarDate): ThemeRoleName {
    const focused = this.state.focused;
    if (focused && compare(date, this.cursor()) === 0) return 'calendarCursor';
    const val = this.value();
    if (val !== null && compare(date, val) === 0) return 'calendarSelected';
    if (compare(date, this.todayDate) === 0) return 'calendarToday';
    if (this.isDisabled?.(date) === true) return 'calendarDisabled';
    return 'calendarNormal';
  }

  /** Paint the header, weekday row, and 6 grid rows per the decode + PA-4 precedence. */
  draw(ctx: DrawContext): void {
    const normal = ctx.color('calendarNormal');
    ctx.fill(' ', normal); // the whole grid background is the normal (cyan) fill (calendar.cpp:137,146,152)
    const wkw = this.showWeekNumbers ? 3 : 0;

    // Row 0 — header (RD-20 extension, module doc §Extensions): '↑↓ '+setw(9)month+' '+setw(4)year+' ↑↓'
    // = 20 cols. LEFT ↑↓ (cols 0-1) = month ±1, RIGHT ↑↓ (cols 18-19) = year ±1 (hit-tested in handleMouse).
    const monthName = MONTH_NAMES[this.visibleMonth()].padStart(9);
    const yearStr = String(this.visibleYear()).padStart(4);
    const header = `${ARROW_UP}${ARROW_DOWN} ${monthName} ${yearStr} ${ARROW_UP}${ARROW_DOWN}`;
    ctx.text(wkw, 0, header, normal);

    // Row 1 — weekday labels (calendar.cpp:147), rotated by firstDayOfWeek.
    const grid = this.currentGrid();
    ctx.text(wkw, 1, grid.weekdayLabels.join(' '), normal);

    // Rows 2-7 — the 6×7 day matrix; each in-month day 2-digit right-justified at dayColumn(j).
    for (let i = 0; i < 6; i += 1) {
      const y = 2 + i;
      const wn = grid.weekNumbers[i];
      if (wn !== null) ctx.text(0, y, String(wn).padStart(2), ctx.color('calendarWeekNumber'));
      for (let j = 0; j < 7; j += 1) {
        const date = grid.rows[i][j];
        if (date === null) continue; // blank (the normal fill already covers it, PF-002)
        ctx.text(dayColumn(j, this.showWeekNumbers), y, String(date.day).padStart(2), ctx.color(this.cellRole(date)));
      }
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────────────────────────────

  /**
   * Keymap (PA-9 / AR-199) + mouse (the decoded header hit columns + day-click commit). Plain arrows
   * are always consumed so they never leave the calendar's focus (AC-6).
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
      default:
        return; // not a calendar key — leave unconsumed
    }
    ev.handled = true;
  }

  /** Header month-nav hit columns (decoded, offset by the week# column) + day-click commit. */
  protected handleMouse(ev: DispatchEvent): void {
    const local = ev.local;
    if (local === undefined) return;
    const wkw = this.showWeekNumbers ? 3 : 0;
    if (local.y === 0) {
      // Flanking header hit columns (offset by the week# column): month ↑↓ at wkw+0/+1, year ↑↓ at
      // wkw+18/+19 (RD-20 extension; up = next/increment, down = prev/decrement, both clamped).
      const dx = local.x - wkw;
      if (dx === 0) this.shiftMonth(1);
      else if (dx === 1) this.shiftMonth(-1);
      else if (dx === 18) this.shiftYear(1);
      else if (dx === 19) this.shiftYear(-1);
      else return;
      ev.handled = true;
      return;
    }
    if (local.y < 2) return;
    const i = local.y - 2;
    const dx = local.x - wkw;
    if (i > 5 || dx < 0) return;
    const j = Math.floor(dx / 3);
    if (j > 6) return;
    const date = this.currentGrid().rows[i][j];
    if (date === null) return;
    this.moveCursor(date); // a single click moves the cursor there…
    this.commit(date); // …and commits (a no-op if disabled/out-of-range, AC-8)
    ev.handled = true;
  }
}
