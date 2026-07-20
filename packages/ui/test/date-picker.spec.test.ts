/**
 * Specification tests (immutable oracles) — jsvision-ui RD-20 `DatePicker` (ST-10…ST-12).
 *
 * Source: RD-20 AC-10…AC-12 (plans/date-family/03-03-date-picker.md Part B; 07-testing-strategy.md).
 * `DatePicker` is a `Group` = a masked `Input` + a trailing `▐↓▌` dropdown button opening a `Calendar` in the
 * generalized anchored popup (mirrors `ComboBox`). Field format = 3 digit-reorder masks over `picture`.
 * `DatePicker` has no TV counterpart — spec oracles only. Expectations derive from the plan/AC.
 *
 * Real objects: a real `EventLoop` supplies the `PopupHost` (the ComboBox test idiom); a real
 * `Calendar` is hosted; synthetic dispatch; headless. A fixed `today` is injected. `.js` specifiers are
 * required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import type { PopupHost } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { DatePicker } from '../src/date/date-picker.js';
import { Calendar } from '../src/date/calendar.js';
import type { CalendarDate } from '../src/date/calendar-date.js';
import type { DateFormat } from '../src/date/date-format.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const TODAY: CalendarDate = { year: 2026, month: 9, day: 3 };

function keyEvent(key: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false, ...mods };
}
function mouseDown(x: number, y: number): MouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}

interface DPHarness {
  loop: ReturnType<typeof createEventLoop>;
  dp: DatePicker;
  overlay: Group;
  value: Signal<CalendarDate | null>;
  text: () => string;
}

function makeDatePicker(
  opts: { value?: CalendarDate | null; format?: DateFormat; withHost?: boolean } = {},
): DPHarness {
  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  const value = signal<CalendarDate | null>(opts.value ?? null);
  const dp = new DatePicker({ value, format: opts.format, today: TODAY });
  dp.setLayout({ position: 'absolute', rect: { x: 5, y: 3, width: 16, height: 1 } });
  const overlay = new Group();
  overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } });
  overlay.state.visible = false;
  const root = new Group();
  root.add(dp);
  root.add(overlay);
  loop.mount(root);
  if (opts.withHost !== false) {
    const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
    loop.popupHost = host;
  }
  loop.renderRoot.flush();
  return { loop, dp, overlay, value, text: () => dp.input.getValueSignal()() };
}

function hostedCalendar(overlay: Group): Calendar | undefined {
  const frame = overlay.children.find((c): c is Group => c instanceof Group);
  return frame?.children.find((c): c is Calendar => c instanceof Calendar);
}
function popupOpen(overlay: Group): boolean {
  return overlay.state.visible && overlay.children.some((c) => c instanceof Group);
}

// ── ST-10: field mask + open/commit/cancel + no-host guard ───────────────────────────────────────

test('ST-10: Down opens the calendar popup when a PopupHost is present', () => {
  const h = makeDatePicker();
  h.loop.focusView(h.dp.input);
  h.loop.dispatch(keyEvent('down'));
  expect(popupOpen(h.overlay), 'popup opened').toBe(true);
  expect(hostedCalendar(h.overlay), 'a Calendar is hosted').toBeInstanceOf(Calendar);
});

test('ST-10: with NO PopupHost, opening is a no-op (headless decline, no crash)', () => {
  const h = makeDatePicker({ withHost: false });
  h.loop.focusView(h.dp.input);
  expect(() => h.loop.dispatch(keyEvent('down'))).not.toThrow();
  expect(popupOpen(h.overlay), 'no popup without a host').toBe(false);
});

test('ST-10: Enter on the calendar cursor commits value AND closes the popup', () => {
  const h = makeDatePicker(); // value null → the hosted calendar cursor inits to today Sep 3
  h.loop.focusView(h.dp.input);
  h.loop.dispatch(keyEvent('down')); // open
  expect(popupOpen(h.overlay)).toBe(true);
  h.loop.dispatch(keyEvent('enter')); // the focused calendar commits its cursor (today) then commit() closes
  expect(h.value(), 'value committed to today').toStrictEqual(TODAY);
  expect(popupOpen(h.overlay), 'popup closed after commit').toBe(false);
});

test('ST-10: Esc dismisses the popup without changing value', () => {
  const h = makeDatePicker();
  h.loop.focusView(h.dp.input);
  h.loop.dispatch(keyEvent('down'));
  h.loop.dispatch(keyEvent('escape'));
  expect(h.value(), 'value unchanged on Esc').toBeNull();
  expect(popupOpen(h.overlay)).toBe(false);
});

test('ST-10: an outside mouse-down dismisses the popup without changing value', () => {
  const h = makeDatePicker();
  h.loop.focusView(h.dp.input);
  h.loop.dispatch(keyEvent('down'));
  h.loop.dispatch(mouseDown(38, 19)); // far bottom-right, outside the popup
  expect(h.value()).toBeNull();
  expect(popupOpen(h.overlay)).toBe(false);
});

// ── ST-11: two-way sync (value ⟷ field text) ─────────────────────────────────────────────────────

test('ST-11: setting value updates the field text via the format serialize', () => {
  const h = makeDatePicker();
  h.value.set({ year: 2026, month: 9, day: 15 });
  h.loop.renderRoot.flush();
  expect(h.text(), 'field shows the ISO-serialized value').toBe('2026-09-15');
});

test('ST-11: a complete valid field edit parses back into value; reopening hosts the calendar on it', () => {
  const h = makeDatePicker();
  h.dp.input.getValueSignal().set('2026-12-25'); // a complete valid edit
  h.loop.renderRoot.flush();
  expect(h.value(), 'complete valid text → value').toStrictEqual({ year: 2026, month: 12, day: 25 });
  h.loop.focusView(h.dp.input);
  h.loop.dispatch(keyEvent('down'));
  expect(hostedCalendar(h.overlay), 'reopen hosts a calendar bound to the shared value').toBeInstanceOf(Calendar);
});

test('ST-11: incomplete or invalid field text leaves value unchanged', () => {
  const h = makeDatePicker({ value: { year: 2026, month: 1, day: 1 } });
  h.loop.renderRoot.flush();
  h.dp.input.getValueSignal().set('2026-12'); // incomplete
  h.loop.renderRoot.flush();
  expect(h.value(), 'incomplete text leaves value unchanged').toStrictEqual({ year: 2026, month: 1, day: 1 });
  h.dp.input.getValueSignal().set('2026-13-40'); // invalid (out of range)
  h.loop.renderRoot.flush();
  expect(h.value(), 'invalid text leaves value unchanged').toStrictEqual({ year: 2026, month: 1, day: 1 });
});

// ── ST-12: configurable format DD/MM/YYYY ────────────────────────────────────────────────────────

test('ST-12: format DD/MM/YYYY orders the field text and parses in that order', () => {
  const h = makeDatePicker({ format: 'DD/MM/YYYY' });
  h.value.set({ year: 2026, month: 9, day: 15 });
  h.loop.renderRoot.flush();
  expect(h.text(), 'DD/MM/YYYY serialization').toBe('15/09/2026');
  h.dp.input.getValueSignal().set('01/02/2026'); // 1 Feb 2026 in DD/MM/YYYY
  h.loop.renderRoot.flush();
  expect(h.value(), 'DD/MM/YYYY parse order').toStrictEqual({ year: 2026, month: 2, day: 1 });
});
