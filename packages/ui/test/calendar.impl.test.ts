/**
 * Implementation tests (edge cases / internals) — RD-20 `Calendar`. Companion to `calendar.spec`:
 * cursor init/clamp, cross-month re-point, Home/End week boundaries, the `select`/`today`/`goToMonth`
 * methods, `onChange` firing, and the full role-precedence matrix (focused vs unfocused). Rendered
 * through the loop; buffer asserted. `.js` specifiers required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Calendar } from '../src/date/calendar.js';
import type { CalendarDate } from '../src/date/calendar-date.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const TODAY: CalendarDate = { year: 2026, month: 9, day: 3 };

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

interface MakeOpts {
  value?: CalendarDate | null;
  today?: CalendarDate;
  min?: CalendarDate;
  max?: CalendarDate;
  isDisabled?: (d: CalendarDate) => boolean;
  firstDayOfWeek?: 0 | 1;
  onChange?: (d: CalendarDate) => void;
  focus?: boolean;
}

function make(opts: MakeOpts = {}) {
  const value: Signal<CalendarDate | null> = signal(opts.value ?? null);
  const cal = new Calendar({
    value,
    today: opts.today ?? TODAY,
    min: opts.min,
    max: opts.max,
    isDisabled: opts.isDisabled,
    firstDayOfWeek: opts.firstDayOfWeek,
    onChange: opts.onChange,
  });
  cal.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 8 } };
  const root = new Group();
  root.add(cal);
  const loop = createEventLoop({ width: 20, height: 8 }, { caps });
  loop.mount(root);
  if (opts.focus) loop.focusView(cal);
  loop.renderRoot.flush();
  const cell = (x: number, y: number) => {
    const c = loop.renderRoot.buffer().get(x, y);
    return c ? { char: c.char, fg: c.fg, bg: c.bg } : undefined;
  };
  const row = (y: number) =>
    loop.renderRoot
      .buffer()
      .rows()
      [y].map((c) => c.char)
      .join('');
  return { cal, loop, value, cell, row };
}

/** The cell at grid (i,j) — the digit (2nd) col of the 2-char day field. */
function gridCell(h: ReturnType<typeof make>, i: number, j: number) {
  return h.cell(j * 3 + 1, 2 + i);
}

test('cursor initializes to value (clamped) when value is set', () => {
  const h = make({ value: { year: 2026, month: 9, day: 20 }, focus: true });
  // Sep 20 at grid row 3 (days 20-26), Sunday col j=0 → digit at (1, 5).
  expect(gridCell(h, 3, 0)?.bg, 'cursor on Sep 20').toBe(defaultTheme.calendarCursor.bg);
});

test('cursor initializes to today when value is null', () => {
  const h = make({ value: null, focus: true }); // cursor = today Sep 3, row0 col j=4 (Thursday)
  expect(gridCell(h, 0, 4)?.bg, 'cursor on today Sep 3').toBe(defaultTheme.calendarCursor.bg);
});

test('cursor init clamps into [min,max]', () => {
  const h = make({ value: null, min: { year: 2026, month: 9, day: 10 }, focus: true });
  // today Sep 3 clamped up to min Sep 10 → cursor at Sep 10 (row1 Thursday col j=4).
  expect(gridCell(h, 1, 4)?.bg).toBe(defaultTheme.calendarCursor.bg);
});

test('select() commits a valid date and is a no-op for a disabled date', () => {
  const changes: CalendarDate[] = [];
  const h = make({ value: null, isDisabled: (d) => d.day === 7, onChange: (d) => changes.push(d) });
  h.cal.select({ year: 2026, month: 9, day: 12 });
  expect(h.value()).toStrictEqual({ year: 2026, month: 9, day: 12 });
  expect(changes.at(-1)).toStrictEqual({ year: 2026, month: 9, day: 12 });
  h.cal.select({ year: 2026, month: 9, day: 7 }); // disabled → no-op
  expect(h.value(), 'disabled select is a no-op').toStrictEqual({ year: 2026, month: 9, day: 12 });
});

test('goToMonth changes the visible month only (value + today preserved)', () => {
  const h = make({ value: { year: 2026, month: 9, day: 10 } });
  h.cal.goToMonth(2027, 1);
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('January 2027')).toBe(true);
  expect(h.value(), 'value untouched by goToMonth').toStrictEqual({ year: 2026, month: 9, day: 10 });
});

test('today() re-points the visible month and cursor to today', () => {
  const h = make({ value: null, focus: true });
  h.cal.goToMonth(2020, 1); // navigate away
  h.loop.renderRoot.flush();
  h.cal.today();
  h.loop.renderRoot.flush();
  expect(h.row(0).includes('September 2026')).toBe(true);
  expect(gridCell(h, 0, 4)?.bg, 'cursor back on today').toBe(defaultTheme.calendarCursor.bg);
});

test('precedence: a cell that is cursor+selected+today shows the cursor colour while focused', () => {
  // value = today = Sep 3; focused so the cursor (init = value) coincides on Sep 3.
  const h = make({ value: { year: 2026, month: 9, day: 3 }, focus: true });
  expect(gridCell(h, 0, 4)?.bg, 'cursor wins while focused').toBe(defaultTheme.calendarCursor.bg);
});

test('precedence: the same cell shows selected (over today) when unfocused', () => {
  const h = make({ value: { year: 2026, month: 9, day: 3 }, focus: false });
  expect(gridCell(h, 0, 4)?.bg, 'selected wins over today when unfocused').toBe(defaultTheme.calendarSelected.bg);
});

test('precedence: today wins over a disabled day on the same cell', () => {
  const h = make({ value: null, isDisabled: (d) => d.day === 3, focus: false }); // today = Sep 3, also disabled
  expect(gridCell(h, 0, 4)?.bg, 'today outranks disabled').toBe(defaultTheme.calendarToday.bg);
});

test('Home/End move to the visible-week first/last day (Sunday-first)', () => {
  const h = make({ value: null, focus: true }); // cursor Sep 3 (Thu), week Sun Aug30..Sat Sep5
  h.loop.dispatch(key('end'));
  h.loop.renderRoot.flush();
  // End → Sep 5 (Saturday, row0 col j=6) digit at (19, 2).
  expect(h.cell(19, 2)?.bg).toBe(defaultTheme.calendarCursor.bg);
});
