/**
 * Implementation coverage for standalone UI fallback isolation.
 *
 * A widget created without an explicit service owns a private English service. Mutating that
 * service through a subclass must never change a later standalone widget.
 */
import { expect, test } from 'vitest';
import type { CatalogInput } from '@jsvision/i18n';
import { Calendar } from '../src/date/calendar.js';
import type { CalendarDate } from '../src/date/calendar-date.js';
import { signal } from '../src/reactive/index.js';
import { createRenderRoot } from '../src/view/index.js';
import { i18nTestCaps } from './fixtures/i18n.js';

const SEPTEMBER_DATE: CalendarDate = { year: 2026, month: 9, day: 3 };

/** Test seam exposing only the protected runtime-overlay operation. */
class MutableCalendar extends Calendar {
  /** Replace this calendar's private English overlay. */
  setPrivateCatalog(catalog: CatalogInput): void {
    this.i18n.setCatalog(catalog);
  }
}

/** Render one compact calendar to plain text. */
function renderCalendar(calendar: Calendar): string {
  const root = createRenderRoot(calendar.measure(), { caps: i18nTestCaps });
  root.mount(calendar);
  return root
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

test('mutating one standalone calendar does not change a later standalone calendar', () => {
  const first = new MutableCalendar({
    value: signal<CalendarDate | null>(SEPTEMBER_DATE),
    today: SEPTEMBER_DATE,
    density: 'compact',
  });
  first.setPrivateCatalog({
    schema: 1,
    locale: 'en',
    messages: { 'ui.calendar.month.september': 'Corrupted' },
  });

  const second = new Calendar({
    value: signal<CalendarDate | null>(SEPTEMBER_DATE),
    today: SEPTEMBER_DATE,
    density: 'compact',
  });

  expect(renderCalendar(second)).toContain('September');
  expect(renderCalendar(second)).not.toContain('Corrupted');
});
