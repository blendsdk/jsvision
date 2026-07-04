/**
 * Specification tests (immutable oracles) — jsvision-ui RD-20 `Calendar` view (ST-2…ST-9).
 *
 * Source: RD-20 AC-2…AC-9 (plans/date-family/03-02-calendar.md; 07-testing-strategy.md). The fidelity
 * cases (ST-4 colours, the grid geometry) diff cell-by-cell against the `TCalendarView` decode
 * (`examples/tvdemo/calendar.cpp:124-171`, GATE-1): a **20×8** view (window `TRect(1,1,23,11)` grown
 * `-1`), weekday row `Su Mo Tu We Th Fr Sa`, 6 week rows of 2-digit days right-justified at col
 * `j*3`, leading blanks; normal `calendarNormal` (`0x3E`), today `calendarToday` (`0x21`). The
 * **header is a documented RD-20 extension** (user request 2026-07-04, ambiguity register runtime
 * notes): thin `↑↓` flanking arrows — `↑↓ September 2026 ↑↓`, LEFT pair = month ±1 (cols 0-1), RIGHT
 * pair = year ±1 (cols 18-19), both clamped to `[min,max]` — replacing TV's right-only `▲/▼` month
 * arrows; the `↑/↓` glyphs match the ComboBox/History dropdown `↓`. Selection / day-cursor / bounds /
 * disabled / week# / first-day are documented extensions too (spec oracles, no `.cpp` diff).
 *
 * Rendered the shipped way (createEventLoop + mount, the tab-strip/feedback idiom); the pre-`serialize`
 * buffer is asserted cell-by-cell. A fixed `today` is injected (no real clock). Reference month is
 * **September 2026** (Sep 1 = Tuesday). Per the immutable-oracle + TV-fidelity rules a failing oracle
 * means the CODE is wrong (and for the TV-derived draw, wrong vs `calendar.cpp`). `.js` specifiers are
 * required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Calendar } from '../src/date/calendar.js';
import type { CalendarDate } from '../src/date/calendar-date.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const TODAY: CalendarDate = { year: 2026, month: 9, day: 3 }; // a Thursday in the reference month

function keyEvent(key: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false, ...mods };
}
/** A left mouse-down at 1-based terminal coords (dispatch normalizes 1-based → 0-based, AR-63). */
function mouseDown(x: number, y: number): MouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}

interface CalHarness {
  cal: Calendar;
  loop: ReturnType<typeof createEventLoop>;
  value: Signal<CalendarDate | null>;
  buffer: () => ReturnType<ReturnType<typeof createEventLoop>['renderRoot']['buffer']>;
  cell: (x: number, y: number) => { char: string; fg: string; bg: string } | undefined;
  row: (y: number) => string;
}

function makeCal(
  opts: {
    value?: CalendarDate | null;
    today?: CalendarDate;
    min?: CalendarDate;
    max?: CalendarDate;
    isDisabled?: (d: CalendarDate) => boolean;
    firstDayOfWeek?: 0 | 1;
    showWeekNumbers?: boolean;
    onChange?: (d: CalendarDate) => void;
    focus?: boolean;
    width?: number;
  } = {},
): CalHarness {
  const value = signal<CalendarDate | null>(opts.value ?? null);
  const cal = new Calendar({
    value,
    today: opts.today ?? TODAY,
    min: opts.min,
    max: opts.max,
    isDisabled: opts.isDisabled,
    firstDayOfWeek: opts.firstDayOfWeek,
    showWeekNumbers: opts.showWeekNumbers,
    onChange: opts.onChange,
  });
  const w = opts.width ?? (opts.showWeekNumbers ? 23 : 20);
  cal.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: 8 } };
  const root = new Group();
  root.add(cal);
  const loop = createEventLoop({ width: w, height: 8 }, { caps });
  loop.mount(root);
  if (opts.focus) loop.focusView(cal);
  loop.renderRoot.flush();
  const buffer = () => loop.renderRoot.buffer();
  const cell = (x: number, y: number) => {
    const c = buffer().get(x, y);
    return c ? { char: c.char, fg: c.fg, bg: c.bg } : undefined;
  };
  const row = (y: number) =>
    buffer()
      .rows()
      [y].map((c) => c.char)
      .join('');
  return { cal, loop, value, buffer, cell, row };
}

// ── ST-2: null value renders (nothing selected, today still highlighted, no crash) ───────────────

test('ST-2: a Calendar with value=null draws no selected day (today still highlighted), no crash', () => {
  const h = makeCal({ value: null });
  // today Sep 3 at grid row 0 (days 1-5), Thursday column j=4 → cols 12-13, y=2 (unfocused → today wins).
  expect(h.cell(13, 2)?.bg, 'today drawn in calendarToday bg').toBe(defaultTheme.calendarToday.bg);
  // No cell carries the selected bg when value is null (scan the grid rows).
  const anySelected = [2, 3, 4, 5, 6, 7].some((y) =>
    Array.from({ length: 20 }, (_, x) => h.cell(x, y)?.bg).some((bg) => bg === defaultTheme.calendarSelected.bg),
  );
  expect(anySelected, 'nothing selected with value=null').toBe(false);
});

// ── ST-3: grid geometry cell-by-cell vs calendar.cpp ─────────────────────────────────────────────

test('ST-3: header — thin ↑↓ month arrows (cols 0-1), setw(9) month, setw(4) year, ↑↓ year arrows (cols 18-19)', () => {
  const h = makeCal({ value: null });
  // Flanking layout (RD-20 extension): '↑↓ September 2026 ↑↓' — month left, year right, thin arrows.
  expect(h.row(0)).toBe('↑↓ September 2026 ↑↓');
  expect(h.cell(0, 0)?.char, '↑ month-next arrow at col 0').toBe('↑');
  expect(h.cell(1, 0)?.char, '↓ month-prev arrow at col 1').toBe('↓');
  expect(h.cell(18, 0)?.char, '↑ year-next arrow at col 18').toBe('↑');
  expect(h.cell(19, 0)?.char, '↓ year-prev arrow at col 19').toBe('↓');
});

test('ST-3: weekday row is "Su Mo Tu We Th Fr Sa" (calendar.cpp:147)', () => {
  const h = makeCal({ value: null });
  expect(h.row(1)).toBe('Su Mo Tu We Th Fr Sa');
});

test('ST-3: days are 2-digit right-justified at col j*3 with correct leading blanks (Sep 1 = Tuesday)', () => {
  const h = makeCal({ value: null });
  // Row 0 (y=2): Su/Mo blank (cols 0-1, 3-4 spaces), Tue=Sep 1 at j=2 → " 1" at cols 6-7.
  expect(h.cell(0, 2)?.char, 'leading Sunday blank').toBe(' ');
  expect(h.cell(3, 2)?.char, 'leading Monday blank').toBe(' ');
  expect(h.cell(6, 2)?.char, 'Sep 1 tens col (space)').toBe(' ');
  expect(h.cell(7, 2)?.char, 'Sep 1 ones col').toBe('1');
  // Sep 5 (Saturday, j=6) at cols 18-19 → " 5".
  expect(h.cell(19, 2)?.char, 'Sep 5 ones col').toBe('5');
  // Sep 15 at grid row 2 (y=4), Tuesday j=2 → "15" at cols 6-7.
  expect(h.cell(6, 4)?.char).toBe('1');
  expect(h.cell(7, 4)?.char).toBe('5');
  // Sep 30 (last day) — grid row 4 (y=6), Wednesday j=3 → "30" at cols 9-10.
  expect(h.cell(9, 6)?.char).toBe('3');
  expect(h.cell(10, 6)?.char).toBe('0');
  // Trailing blank after Sep 30 (Thursday col j=4, cols 12-13) is empty.
  expect(h.cell(13, 6)?.char, 'trailing blank').toBe(' ');
});

// ── ST-4: today / normal / selected colours (calendar.cpp getColor(6)/getColor(7)) ───────────────

test('ST-4: today is calendarToday (0x21), other in-month days are calendarNormal (0x3E)', () => {
  const h = makeCal({ value: null }); // unfocused → no cursor; today wins
  // today Sep 3 at (13,2): blue-on-green.
  expect(h.cell(13, 2)?.fg, 'today fg (blue)').toBe(defaultTheme.calendarToday.fg);
  expect(h.cell(13, 2)?.bg, 'today bg (green)').toBe(defaultTheme.calendarToday.bg);
  // a normal day Sep 5 at (19,2): yellow-on-cyan.
  expect(h.cell(19, 2)?.fg, 'normal fg (yellow)').toBe(defaultTheme.calendarNormal.fg);
  expect(h.cell(19, 2)?.bg, 'normal bg (cyan)').toBe(defaultTheme.calendarNormal.bg);
});

test('ST-4: a selected day is calendarSelected (0x1F) and is separable from today', () => {
  const h = makeCal({ value: { year: 2026, month: 9, day: 10 } }); // Sep 10 selected, unfocused
  // Sep 10 at grid row 1 (y=3), Thursday j=4 → cols 12-13.
  expect(h.cell(13, 3)?.bg, 'selected bg (blue)').toBe(defaultTheme.calendarSelected.bg);
  expect(h.cell(13, 3)?.fg, 'selected fg (white)').toBe(defaultTheme.calendarSelected.fg);
  // today Sep 3 still its own colour (separable).
  expect(h.cell(13, 2)?.bg, 'today still green').toBe(defaultTheme.calendarToday.bg);
});

// ── ST-5: commit sets value; selected wins over today; month-nav leaves value unchanged ──────────

test('ST-5: Enter on the cursor sets value; selected wins over today (PA-4); month-nav keeps value', () => {
  const onChange: CalendarDate[] = [];
  const h = makeCal({ value: null, focus: true, onChange: (d) => onChange.push(d) });
  // cursor initialized to value ?? today = Sep 3.
  h.loop.dispatch(keyEvent('enter')); // commit Sep 3
  expect(h.value(), 'value committed to Sep 3').toStrictEqual({ year: 2026, month: 9, day: 3 });
  expect(onChange.at(-1), 'onChange fired with the committed date').toStrictEqual({ year: 2026, month: 9, day: 3 });
  // move the cursor off Sep 3 so the cell shows selected (not cursor): → to Sep 4.
  h.loop.dispatch(keyEvent('right'));
  h.loop.renderRoot.flush();
  expect(h.cell(13, 2)?.bg, 'Sep 3 now selected (selected > today)').toBe(defaultTheme.calendarSelected.bg);
  // '+' changes the visible month but must NOT change value.
  h.loop.dispatch(keyEvent('+'));
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('October 2026'), 'visible month advanced').toBe(true);
  expect(h.value(), 'value unchanged by month nav').toStrictEqual({ year: 2026, month: 9, day: 3 });
});

// ── ST-6: day-nav keymap; plain arrows keep focus ────────────────────────────────────────────────

/** Read the 2-digit day currently under the calendarCursor cell (scanning the grid rows). */
function cursorDay(h: CalHarness, wkw = 0): number | null {
  const cur = defaultTheme.calendarCursor;
  for (let y = 2; y <= 7; y += 1) {
    for (let x = wkw; x < wkw + 20; x += 1) {
      const c = h.cell(x, y);
      if (c && c.bg === cur.bg && c.fg === cur.fg) {
        const j = Math.floor((x - wkw) / 3);
        const s = (h.cell(wkw + j * 3, y)?.char ?? '') + (h.cell(wkw + j * 3 + 1, y)?.char ?? '');
        const n = parseInt(s.trim(), 10);
        return Number.isNaN(n) ? null : n;
      }
    }
  }
  return null;
}

test('ST-6: arrows move the cursor by ±1 day / ±1 week; plain arrows never leave the calendar focus', () => {
  const h = makeCal({ value: null, focus: true }); // cursor = today Sep 3
  expect(cursorDay(h)).toBe(3);
  h.loop.dispatch(keyEvent('right'));
  h.loop.renderRoot.flush();
  expect(cursorDay(h), '→ +1 day').toBe(4);
  expect(h.loop.getFocused(), 'plain arrow keeps focus on the calendar').toBe(h.cal);
  h.loop.dispatch(keyEvent('left'));
  h.loop.dispatch(keyEvent('left'));
  h.loop.renderRoot.flush();
  expect(cursorDay(h), '← ← -2 days → Sep 2').toBe(2);
  h.loop.dispatch(keyEvent('down'));
  h.loop.renderRoot.flush();
  expect(cursorDay(h), '↓ +7 days → Sep 9').toBe(9);
  h.loop.dispatch(keyEvent('up'));
  h.loop.renderRoot.flush();
  expect(cursorDay(h), '↑ -7 days → Sep 2').toBe(2);
});

test('ST-6: PgDn/PgUp move ±1 month; a cross-month move re-points the visible month', () => {
  const h = makeCal({ value: null, focus: true }); // cursor Sep 3
  h.loop.dispatch(keyEvent('pagedown'));
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('October 2026'), 'PgDn → October').toBe(true);
  expect(cursorDay(h), 'cursor now Oct 3').toBe(3);
  h.loop.dispatch(keyEvent('pageup'));
  h.loop.dispatch(keyEvent('pageup'));
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('August 2026'), 'PgUp twice → August').toBe(true);
});

test('ST-6: Home/End move to the first/last day of the cursor visible week', () => {
  const h = makeCal({ value: null, focus: true }); // cursor Sep 3 (Thu), week = Sun Aug 30 … Sat Sep 5
  h.loop.dispatch(keyEvent('end'));
  h.loop.renderRoot.flush();
  expect(cursorDay(h), 'End → Saturday Sep 5').toBe(5);
  h.loop.dispatch(keyEvent('home'));
  h.loop.renderRoot.flush();
  // Home → Sunday Aug 30 (crosses into the previous month → visible month re-points to August).
  expect(h.row(0).includes('August 2026'), 'Home crossed into August').toBe(true);
  expect(cursorDay(h)).toBe(30);
});

// ── ST-7: header nav — month arrows (left) + year arrows (right), clamped, value preserved ─────────

test('ST-7: ↑↓ (cols 0-1) change the month; ↑↓ (cols 18-19) change the year; value preserved', () => {
  const h = makeCal({ value: { year: 2026, month: 9, day: 10 } });
  h.loop.dispatch(mouseDown(1, 1)); // local (0,0) = ↑ month-next
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('October 2026'), '↑ (col 0) → October').toBe(true);
  expect(h.value(), 'value unchanged by header nav').toStrictEqual({ year: 2026, month: 9, day: 10 });
  h.loop.dispatch(mouseDown(2, 1)); // local (1,0) = ↓ month-prev
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('September 2026'), '↓ (col 1) → back to September').toBe(true);
  h.loop.dispatch(mouseDown(19, 1)); // local (18,0) = ↑ year-next
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('September 2027'), '↑ (col 18) → 2027').toBe(true);
  h.loop.dispatch(mouseDown(20, 1)); // local (19,0) = ↓ year-prev
  h.loop.dispatch(mouseDown(20, 1));
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('September 2025'), '↓↓ (col 19) → 2025').toBe(true);
});

test('ST-7: header month/year arrows clamp to [min,max] — the visible view cannot page out of range', () => {
  const h = makeCal({
    value: null,
    min: { year: 2026, month: 1, day: 1 },
    max: { year: 2026, month: 12, day: 31 },
  });
  // Year-next from Sep 2026 would reach 2027 > max.year → clamped to the max month, Dec 2026.
  h.loop.dispatch(mouseDown(19, 1)); // ↑ year-next
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('December 2026'), 'year-next clamped to max Dec 2026').toBe(true);
  // Month-next from Dec 2026 would reach Jan 2027 > max → clamped (stays December).
  h.loop.dispatch(mouseDown(1, 1)); // ↑ month-next
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('December 2026'), 'month-next clamped at the max edge').toBe(true);
  // Year-prev twice → 2024 < min → clamped to the min month, Jan 2026.
  h.loop.dispatch(mouseDown(20, 1)); // ↓ year-prev
  h.loop.dispatch(mouseDown(20, 1));
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('January 2026'), 'year-prev clamped to min Jan 2026').toBe(true);
});

// ── ST-8: min/max clamp the cursor; disabled day is dimmed, navigable, non-committable ────────────

test('ST-8: the cursor cannot move before min; a disabled day is dimmed + navigable + Enter is a no-op', () => {
  const disabled = (d: CalendarDate) => d.day === 7;
  const h = makeCal({ value: null, focus: true, min: { year: 2026, month: 9, day: 5 }, isDisabled: disabled });
  // cursor init = clamp(today Sep 3, min Sep 5) = Sep 5.
  expect(cursorDay(h), 'cursor clamped up to min Sep 5').toBe(5);
  h.loop.dispatch(keyEvent('left')); // Sep 4 < min → clamped back to Sep 5
  h.loop.renderRoot.flush();
  expect(cursorDay(h), 'cannot move before min').toBe(5);
  // navigate onto the disabled Sep 7 (→ →).
  h.loop.dispatch(keyEvent('right'));
  h.loop.dispatch(keyEvent('right'));
  h.loop.renderRoot.flush();
  expect(cursorDay(h), 'disabled day is still navigable').toBe(7);
  // Sep 7 drawn dimmed (disabled) — but the cursor cell wins while focused, so blur-equivalent check:
  // the underlying disabled colour shows when not under the cursor. Assert Enter is a no-op regardless.
  h.loop.dispatch(keyEvent('enter'));
  expect(h.value(), 'Enter on a disabled day does not commit').toBeNull();
});

test('ST-8: a disabled in-month day (not under the cursor) is drawn calendarDisabled', () => {
  const h = makeCal({ value: null, isDisabled: (d) => d.day === 7 }); // unfocused → no cursor
  // Sep 7 at grid row 1 (y=3), Monday j=1 → cols 3-4.
  expect(h.cell(4, 3)?.fg, 'disabled day fg (darkGray)').toBe(defaultTheme.calendarDisabled.fg);
  expect(h.cell(4, 3)?.bg, 'disabled day bg (cyan)').toBe(defaultTheme.calendarDisabled.bg);
});

// ── ST-9: firstDayOfWeek rotation + ISO week-number column ────────────────────────────────────────

test('ST-9: firstDayOfWeek=1 starts the header at "Mo" and shifts day 1 accordingly', () => {
  const h = makeCal({ value: null, firstDayOfWeek: 1 });
  expect(h.row(1)).toBe('Mo Tu We Th Fr Sa Su'); // rotated one column
  // Sep 1 (Tuesday) now at column j=1 → cols 3-4 → " 1".
  expect(h.cell(4, 2)?.char, 'Sep 1 ones col at Monday-first column 1').toBe('1');
});

test('ST-9: showWeekNumbers adds a leading ISO-week column; header ↑↓ hit columns shift by 3', () => {
  const h = makeCal({ value: null, firstDayOfWeek: 1, showWeekNumbers: true });
  // Week-number column at cols 0-1; row 0 (Mon Aug 31 … Sun Sep 6) Thursday = Sep 3 → ISO week 36.
  expect(h.cell(0, 2)?.char, 'week number tens').toBe('3');
  expect(h.cell(1, 2)?.char, 'week number ones').toBe('6');
  expect(h.cell(0, 2)?.fg, 'week number fg (black)').toBe(defaultTheme.calendarWeekNumber.fg);
  // The day columns shift right by 3: Sep 1 (Monday-first col j=1) now at cols 6-7 → " 1".
  expect(h.cell(7, 2)?.char, 'Sep 1 shifted right by the week# column').toBe('1');
  // With week numbers on, the month-next ↑ hit column shifts to 3+0 = 3 — a click there still navigates.
  h.loop.dispatch(mouseDown(4, 1)); // local (3,0) = shifted month-next arrow
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('October 2026'), 'shifted ↑ month-next still advances the month').toBe(true);
  // The year-next ↑ hit column shifts to 3+18 = 21.
  h.loop.dispatch(mouseDown(22, 1)); // local (21,0) = shifted year-next arrow
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('October 2027'), 'shifted ↑ year-next advances the year').toBe(true);
});
