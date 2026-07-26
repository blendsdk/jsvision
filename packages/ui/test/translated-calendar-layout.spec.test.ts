/**
 * Immutable requirements for localized Calendar and DatePicker geometry.
 *
 * One display-cell metric must cover month/year headers, weekday columns, the selected-date echo,
 * and Today. DatePicker must allocate its hosted Calendar from that same localized result.
 */
import { describe, expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createI18n, defineCatalog } from '@jsvision/i18n';
import { Calendar } from '../src/date/calendar.js';
import type { CalendarDate } from '../src/date/calendar-date.js';
import { DatePicker } from '../src/date/date-picker.js';
import { uiDe, uiEn, uiEs, uiFr, uiIt, uiNl, uiPl, uiPtPT, uiRo, uiSv } from '../src/i18n/locales.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Group } from '../src/view/index.js';
import { at } from '../src/view/index.js';
import type { PopupHost } from '../src/view/index.js';
import { stringWidth } from '../src/controls/measure.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const date: CalendarDate = { year: 2026, month: 9, day: 3 };
const localeCatalogs = [uiEn, uiNl, uiDe, uiFr, uiEs, uiIt, uiPtPT, uiPl, uiRo, uiSv];

describe.each(localeCatalogs)('Calendar intrinsic geometry for $locale', (catalog) => {
  test('contains every official month/year header and Today label', () => {
    const i18n = createI18n({ locale: catalog.locale, catalogs: [catalog] });
    const calendar = new Calendar({ value: signal(date), today: date, density: 'comfortable', i18n });
    const width = calendar.measure().width;
    const months = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ];
    for (const month of months) {
      const label = i18n.t(`ui.calendar.month.${month}`);
      expect(width).toBeGreaterThanOrEqual(stringWidth(`${label} 2026`) + 4);
    }
    expect(width).toBeGreaterThanOrEqual(stringWidth(i18n.t('ui.calendar.today')) + 4);
  });
});

const unicodeCalendar = createI18n({
  locale: 'ja',
  catalogs: [
    defineCatalog({
      schema: 1,
      locale: 'ja',
      messages: {
        'ui.calendar.month.september': '非常に長い九月の表示名',
        'ui.calendar.today': '今日へ移動',
        'ui.calendar.weekday.sunday.short3': '日曜日',
        'ui.calendar.weekday.monday.short3': '月\u0301曜日',
      },
    }),
  ],
});

test('wide localized month and Today text enlarge Calendar intrinsic width without splitting cells', () => {
  const calendar = new Calendar({
    value: signal(date),
    today: date,
    density: 'comfortable',
    i18n: unicodeCalendar,
  });
  const header = `${unicodeCalendar.t('ui.calendar.month.september')} 2026`;
  expect(calendar.measure().width).toBeGreaterThanOrEqual(stringWidth(header) + 4);
  expect(calendar.measure().width).toBeGreaterThanOrEqual(stringWidth(unicodeCalendar.t('ui.calendar.today')) + 4);
  expect(calendar.measure().width).toBeGreaterThanOrEqual(7 * stringWidth('日曜日'));
});

test('a hard-width Calendar keeps right-side arrows and Today inside clickable bounds', () => {
  const value = signal<CalendarDate | null>({ year: 2026, month: 8, day: 1 });
  const calendar = new Calendar({ value, today: date, density: 'comfortable', i18n: unicodeCalendar });
  const height = calendar.measure().height;
  const width = 18;
  const root = new Group();
  root.add(at(calendar, 0, 0, width, height));
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  const before = loop.renderRoot
    .buffer()
    .rows()[0]
    .map((cell) => cell.char)
    .join('');

  loop.dispatch({ type: 'mouse', kind: 'down', x: width - 1, y: 1, button: 0 });
  loop.renderRoot.flush();
  const after = loop.renderRoot
    .buffer()
    .rows()[0]
    .map((cell) => cell.char)
    .join('');
  expect(after).not.toBe(before);

  loop.dispatch({ type: 'mouse', kind: 'down', x: width, y: height, button: 0 });
  expect(value()).toEqual(date);
});

test('DatePicker hosts its localized Calendar at the Calendar intrinsic size', () => {
  const value = signal<CalendarDate | null>(date);
  const picker = new DatePicker({ value, today: date, i18n: unicodeCalendar });
  picker.setLayout({ position: 'absolute', rect: { x: 5, y: 2, width: 16, height: 1 } });
  const overlay = new Group();
  overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 80, height: 24 } });
  overlay.state.visible = false;
  const root = new Group();
  root.add(picker);
  root.add(overlay);
  const loop = createEventLoop({ width: 80, height: 24 }, { caps });
  loop.mount(root);
  const popupHost: PopupHost = {
    overlay,
    focusView: (view) => loop.focusView(view),
    getFocused: () => loop.getFocused(),
  };
  loop.popupHost = popupHost;
  loop.focusView(picker.input);
  loop.dispatch({ type: 'key', key: 'down', ctrl: false, alt: true, shift: false });

  const frame = overlay.children.find((view): view is Group => view instanceof Group);
  const hosted = frame?.children.find((view): view is Calendar => view instanceof Calendar);
  const expected = new Calendar({ value: signal(date), today: date, i18n: unicodeCalendar }).measure();
  expect(hosted).toBeDefined();
  expect(hosted!.bounds.width).toBe(expected.width);
  expect(hosted!.bounds.height).toBe(expected.height);
});
